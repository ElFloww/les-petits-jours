FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY Directory.Build.props global.json dotnet-tools.json ./
COPY database/ database/
RUN dotnet build database/Advent.Database.sqlproj -c Release --nologo \
    && dotnet tool restore
ENV DOTNET_ROLL_FORWARD=Major
ENV DACFX_TELEMETRY_OPTOUT=true
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
COPY deploy/publish-schema.sh /publish-schema.sh
RUN sed -i 's/\r$//' /publish-schema.sh
ENTRYPOINT ["sh", "/publish-schema.sh"]
