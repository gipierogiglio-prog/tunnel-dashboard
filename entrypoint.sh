#!/bin/sh
set -e

# Fix SSH key permissions (mounted volume preserves host perms)
if [ -f /root/.ssh/id_rsa ]; then
  cp /root/.ssh/id_rsa /tmp/id_rsa
  chmod 600 /tmp/id_rsa
  export SSH_KEY=/tmp/id_rsa
  echo "SSH key configured"
fi

# Start the app
exec node server.js
