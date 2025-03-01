FROM 84codes/crystal:latest-alpine AS builder
WORKDIR /usr/src/ecocirc
COPY ecocirc.cr .
RUN crystal build --release --stats --static -Dwithout_openssl ecocirc.cr

FROM scratch
COPY --from=builder /usr/src/ecocirc/ecocirc /
EXPOSE 8080
ENTRYPOINT ["/ecocirc"]
