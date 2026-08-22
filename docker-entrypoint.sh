#!/bin/sh
set -eu

chown -R nextjs:nodejs /data
exec gosu nextjs "$@"
