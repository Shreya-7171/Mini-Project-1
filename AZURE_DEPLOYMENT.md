# CivicVision Azure deployment

This project deploys as two Azure App Service containers: a static Next.js frontend and a FastAPI/YOLO API. Azure provides the public HTTPS URLs. SQLite and uploaded images are stored under `/home/data`; keep the API at one instance unless moving those records to a shared database and storage service.

## Prerequisites

- An Azure subscription with permission to create App Service and Azure Container Registry resources.
- Azure CLI, then `az login`.
- No custom domain is required. App Service supplies `*.azurewebsites.net` HTTPS URLs.

The commands below create billable resources (an App Service B2 plan and Basic ACR). Choose a region and review the Azure estimate before creating them.

## Create registry and apps

Run from this directory in PowerShell. Replace the subscription and region as appropriate. The suffix keeps globally unique Azure resource names.

```powershell
az login
az account set --subscription "<subscription-id>"

$location = "centralindia"
$resourceGroup = "civicvision-rg"
$suffix = Get-Random -Minimum 100000 -Maximum 999999
$registry = "civicvision$suffix"
$plan = "civicvision-plan-$suffix"
$apiApp = "civicvision-api-$suffix"
$webApp = "civicvision-web-$suffix"

az group create --name $resourceGroup --location $location
az acr create --resource-group $resourceGroup --name $registry --sku Basic
az acr update --name $registry --admin-enabled true
az appservice plan create --resource-group $resourceGroup --name $plan --location $location --is-linux --sku B2

az webapp create --resource-group $resourceGroup --plan $plan --name $apiApp --container-image-name nginx:alpine
az webapp create --resource-group $resourceGroup --plan $plan --name $webApp --container-image-name nginx:alpine

$registryHost = az acr show --name $registry --query loginServer --output tsv
$registryUser = az acr credential show --name $registry --query username --output tsv
$registryPassword = az acr credential show --name $registry --query "passwords[0].value" --output tsv
$apiUrl = "https://$apiApp.azurewebsites.net"
$webUrl = "https://$webApp.azurewebsites.net"
```

## Build and deploy the API

ACR builds the image in Azure, so Docker does not need to be installed locally.

```powershell
az acr build --registry $registry --image civicvision-api:1 --file Dockerfile Backend
az webapp config container set --resource-group $resourceGroup --name $apiApp --container-image-name "$registryHost/civicvision-api:1" --container-registry-url "https://$registryHost" --container-registry-user $registryUser --container-registry-password $registryPassword

$secretKey = python -c "import secrets; print(secrets.token_urlsafe(48))"
az webapp config appsettings set --resource-group $resourceGroup --name $apiApp --settings WEBSITES_PORT=8000 WEBSITES_ENABLE_APP_SERVICE_STORAGE=true DATA_DIR=/home/data WEBSITES_CONTAINER_START_TIME_LIMIT=1800 APP_ENV=production SECRET_KEY=$secretKey "CORS_ORIGINS=$webUrl,https://localhost"
az webapp restart --resource-group $resourceGroup --name $apiApp
```

The app must use one API instance while it uses SQLite. App Service persistent storage must stay enabled so its database and image uploads survive restarts.

## Build and deploy the frontend

The API URL is baked into the static frontend during its build.

```powershell
az acr build --registry $registry --image civicvision-web:1 --file Dockerfile --build-arg "NEXT_PUBLIC_API_URL=$apiUrl" .
az webapp config container set --resource-group $resourceGroup --name $webApp --container-image-name "$registryHost/civicvision-web:1" --container-registry-url "https://$registryHost" --container-registry-user $registryUser --container-registry-password $registryPassword
az webapp config appsettings set --resource-group $resourceGroup --name $webApp --settings WEBSITES_PORT=80
az webapp restart --resource-group $resourceGroup --name $webApp
```

Open `$webUrl`, create an account, and check `/health` at `$apiUrl/health`.

## Build the installable Android APK

Install Android Studio and its Android SDK first. Then build the APK against the Azure API URL:

```powershell
$env:NEXT_PUBLIC_API_URL = $apiUrl
pnpm apk:debug
```

The APK is at `android\app\build\outputs\apk\debug\app-debug.apk`. This debug APK can be sideloaded for testing. Do not distribute a LAN-HTTP APK; it only reaches the development computer and allows unencrypted API traffic. For wider distribution, use the Azure HTTPS API URL as above. A store release should use a release signing key and a release build.
