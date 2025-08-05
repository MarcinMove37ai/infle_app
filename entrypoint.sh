#!/bin/sh
# Ten skrypt jest uruchamiany jako root

# 1. Zmień właściciela wolumenu na użytkownika 'nextjs' i grupę 'nodejs'.
#    Ta komenda zadziała, bo jesteśmy `root`.
chown -R nextjs:nodejs /data

# 2. Użyj 'su-exec' (narzędzie w Alpine Linux), aby przełączyć się
#    na użytkownika 'nextjs' i uruchomić komendę startową aplikacji.
#    "$@" to wszystkie argumenty z linii CMD w Dockerfile.
exec su-exec nextjs "$@"