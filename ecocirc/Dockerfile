FROM 84codes/crystal:latest-alpine AS builder
WORKDIR /tmp
COPY ecocirc.cr .
RUN crystal build --release --static -Dwithout_openssl ecocirc.cr

FROM scratch
COPY --from=builder /tmp/ecocirc /
EXPOSE 8080
ENTRYPOINT ["/ecocirc"]
