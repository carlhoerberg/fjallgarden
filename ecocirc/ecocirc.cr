require "socket"

class ModbusTCPClient
  @socket : TCPSocket

  def initialize(@host : String, @port = 502)
    @lock = Mutex.new
    @socket = TCPSocket.new(@host, @port, connect_timeout: 1)
    set_socket_options(@socket)
  end

  def close
    @socket.close
  end

  def write_holding_registers(address, values : Indexable(Int16 | UInt16), unit_id = 1)
    raise ArgumentError.new("Too many values") if values.size >= 128
    with_socket do |socket|
      transaction_id = rand(UInt16) # Random transaction ID
      protocol_id = 0_u16           # Modbus Protocol ID
      length = 6_u16                # Number of bytes after this field
      function_code = 16_u8         # Function code for reading holding registers
      count = values.size
      bytesize = count * 2
      socket.write_bytes transaction_id.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_bytes protocol_id.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_bytes length.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_byte unit_id.to_u8
      socket.write_byte function_code.to_u8
      socket.write_bytes address.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_bytes count.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_bytes bytes.to_u8, IO::ByteFormat::NetworkEndian
      values.each do |v|
        socket.write_bytes v, IO::ByteFormat::NetworkEndian
      end
      socket.flush
    end
  end

  def read_holding_registers(address, count, unit_id = 1)
    with_socket do |socket|
      transaction_id = rand(UInt16) # Random transaction ID
      protocol_id = 0_u16           # Modbus Protocol ID
      length = 6_u16                # Number of bytes after this field
      function_code = 3_u8          # Function code for reading holding registers

      # Construct Modbus TCP request
      socket.write_bytes transaction_id.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_bytes protocol_id.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_bytes length.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_byte unit_id.to_u8
      socket.write_byte function_code.to_u8
      socket.write_bytes address.to_u16, IO::ByteFormat::NetworkEndian
      socket.write_bytes count.to_u16, IO::ByteFormat::NetworkEndian
      socket.flush

      if transaction_id != (tid = socket.read_bytes UInt16, IO::ByteFormat::NetworkEndian)
        raise Error.new "Unexpected transaction id #{tid} != #{transaction_id}"
      end
      if protocol_id != (pi = socket.read_bytes UInt16, IO::ByteFormat::NetworkEndian)
        raise Error.new "Unexpected protocol #{pi} != #{protocol_id}"
      end
      response_length = socket.read_bytes UInt16, IO::ByteFormat::NetworkEndian
      if unit_id != (uid = socket.read_byte || raise IO::EOFError.new)
        raise Error.new "Unexpected unit #{uid} != #{unit_id}"
      end
      response_function = socket.read_byte || raise IO::EOFError.new
      if (response_function >> 7) == 1 # highest bit set indicates an exception
        case exception_code = socket.read_byte
        when 1 then raise Error.new "Invalid function"
        when 2 then raise Error.new "Invalid address"
        when 3 then raise Error.new "Invalid data"
        else        raise Error.new "Exception code #{exception_code}"
        end
      end

      if response_function != function_code
        raise Error.new "Unexpected function #{response_function} != #{function_code}"
      end
      bytesize = socket.read_byte || raise IO::EOFError.new
      Array(UInt16).new(bytesize // sizeof(UInt16)) do
        socket.read_bytes UInt16, IO::ByteFormat::NetworkEndian
      end
    end
  end

  private def with_socket(& : TCPSocket -> _)
    try = 0
    @lock.synchronize do
      loop do
        return yield @socket
      rescue ex : IO::Error
        STDERR.puts ex.message
        @socket.close
        @socket = TCPSocket.new(@host, @port, connect_timeout: 1)
        set_socket_options(@socket)
        raise ex if (try += 1) > 1
      end
    end
  end

  private def set_socket_options(socket)
    socket.sync = false
    socket.read_buffering = true
    socket.read_timeout = 1.seconds
    socket.write_timeout = 1.seconds
  end

  class Error < Exception; end
end

class ModbusRTUoverTCPClient < ModbusTCPClient
  def write_holding_registers(address, values : Indexable(Int16 | UInt16), unit_id = 1)
    raise "not implemented yet"
  end

  @io = IO::Memory.new

  def read_holding_registers(address, count, unit_id = 1)
    with_socket do |socket|
      function_code = 3_u8 # Function code for reading holding registers

      # Construct Modbus RTU request
      @io.write_byte unit_id.to_u8
      @io.write_byte function_code.to_u8
      @io.write_bytes address.to_u16, IO::ByteFormat::NetworkEndian
      @io.write_bytes count.to_u16, IO::ByteFormat::NetworkEndian
      @io.write_bytes crc16(@io.to_slice), IO::ByteFormat::NetworkEndian
      socket.write @io.to_slice
      @io.clear

      if unit_id != (uid = socket.read_byte || raise IO::EOFError.new)
        raise Error.new "Unexpected unit #{uid} != #{unit_id}"
      end
      response_function = socket.read_byte || raise IO::EOFError.new
      if (response_function >> 7) == 1 # highest bit set indicates an exception
        case exception_code = socket.read_byte
        when 1 then raise Error.new "Invalid function"
        when 2 then raise Error.new "Invalid address"
        when 3 then raise Error.new "Invalid data"
        else        raise Error.new "Exception code #{exception_code}"
        end
      end

      if response_function != function_code
        raise Error.new "Unexpected function #{response_function} != #{function_code}"
      end
      bytesize = socket.read_byte || raise IO::EOFError.new
      values = Array(UInt16).new(bytesize // sizeof(UInt16)) do
        socket.read_bytes UInt16, IO::ByteFormat::NetworkEndian
      end
      rcrc = socket.read_bytes UInt16, IO::ByteFormat::NetworkEndian

      values
    end
  end

  # Computes the CRC16 Modbus for the given data.
  # data : Array(UInt8) – The data for which to compute the CRC.
  # Returns: UInt16 – The computed CRC.
  def crc16(data : Bytes) : UInt16
    crc = 0xFFFF_u16
    data.each do |b|
      crc = crc ^ b.to_u16
      8.times do
        if (crc & 1) != 0
          crc = (crc >> 1) ^ 0xA001_u16
        else
          crc = crc >> 1
        end
      end
    end
    crc
  end

  private def set_socket_options(socket)
    super
    socket.sync = true
  end
end

class Ecocirc
  def initialize(address = "192.168.40.20")
    @modbus = ModbusTCPClient.new(address)
  end

  def measurements
    values = @modbus.read_holding_registers(0x0200, 0x10)
    {
      power:       values[0],         # watt
      head:        values[1] / 100.0, # meters
      flow:        values[2] / 10.0,  # liters/second
      speed:       values[3],         # rpm
      temperature: values[4] / 10.0,  # celsius
      # external_temperature:  values[5] / 10.0,
      # winding_1_temperature: values[6],
      # winding_2_temperature: values[7],
      # winding_3_temperature: values[8],
      module_temperature: values[9],
      quadrant_current:   values[10] / 100.0, # ampere
      status_io:          values[11],         # bit field
      alarms1:            values[12],         # bit field
      alarms2:            values[13],         # bit field
      errors:             values[14],         # bit field
      error_code:         values[15],
    }
  end

  def operating=(value : Bool)
    @modbus.write_holding_registers(0x0000, [value ? 1 : 0])
  end

  enum ControlMode
    ConstantPressure    = 1
    ProportionalPressue = 2
    ConstantCurve       = 3
  end

  def control_mode=(mode : ControlMode)
    @modbus.write_holding_registers(0x0001, [mode.value])
  end

  def night_mode=(value : Bool)
    @modbus.write_holding_registers(0x0002, [value ? 1 : 0])
  end
end

require "http/server"

spawn do
  udp = UDPSocket.new
  udp.bind "0.0.0.0", 1234
  loop do
    message, _client_addr = udp.receive
    puts message
  end
end

ecocirc = Ecocirc.new

server = HTTP::Server.new([
  HTTP::ErrorHandler.new,
  HTTP::CompressHandler.new,
]) do |context|
  case context.request.path
  when "/metrics"
    context.response.content_type = "text/plain"
    measurements = begin
      ecocirc.measurements
    rescue ex : IO::Error
      context.response.respond_with_status(HTTP::Status::SERVICE_UNAVAILABLE, ex.message)
      next
    end
    measurements.each do |key, value|
      context.response.puts "# TYPE ecocirc_#{key} gauge"
      context.response.puts "ecocirc_#{key} #{value}"
    end
  else
    context.response.respond_with_status(HTTP::Status::NOT_FOUND)
  end
end

address = server.bind_tcp "::", 8080
puts "Listening on http://#{address}"
server.listen
