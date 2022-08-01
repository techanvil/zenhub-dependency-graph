#!/bin/sh

repo_root=$( cd "$( dirname "$0}" )"/.. && pwd )

cd "$repo_root"

npx http-server
