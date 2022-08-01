#!/bin/sh

repo_root=$( cd "$( dirname "$0}" )"/.. && pwd )

zenhub_api_key=$( grep zenhubApiKey "$repo_root/src/config.json" | cut -d ' ' -f 4 | tr -d \" )

npx get-graphql-schema --header "Authorization=Bearer $zenhub_api_key" https://api.zenhub.com/public/graphql/ > "$repo_root/schema.graphql"
