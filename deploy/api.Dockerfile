FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY global.json Directory.Build.props ./
COPY src/ src/
RUN dotnet publish src/Advent.Api/Advent.Api.csproj -c Release -o /app --nologo

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
    && mkdir /keys && chown "$APP_UID" /keys
WORKDIR /app
COPY --from=build /app .
COPY deploy/local-api-entrypoint.sh /usr/local/bin/local-api-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/local-api-entrypoint.sh && chmod 555 /usr/local/bin/local-api-entrypoint.sh
ENV ASPNETCORE_HTTP_PORTS=8080
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Advent.Api.dll"]
