FROM mcr.microsoft.com/mssql/server:2022-latest
USER root
RUN mkdir -p /run/advent-secrets \
    && chown mssql:mssql /run/advent-secrets \
    && chmod 700 /run/advent-secrets
COPY --chown=mssql:mssql deploy/local-sql-entrypoint.sh /usr/local/bin/local-sql-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/local-sql-entrypoint.sh \
    && chmod 500 /usr/local/bin/local-sql-entrypoint.sh
USER mssql
ENTRYPOINT ["/bin/bash", "/usr/local/bin/local-sql-entrypoint.sh"]
