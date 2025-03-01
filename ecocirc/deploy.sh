#!/usr/bin/env bash
set -eu
pushd $(dirname $BASH_SOURCE[0])
podman build -t ecocirc --output . .
scp ecocirc root@grafana:.
ssh root@grafana mv ecocirc /opt/ecocirc
ssh root@grafana systemctl restart ecocirc.service
popd
