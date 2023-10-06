This project is used to obtain the directory structure on the cloud disk. Each time the task is run, it will retrieve a directory to expand from the server. The task will obtain the directory structure at that level and return it to the server, ending the current run.

This project will run as a Cloudflare worker. By manually executing the deploy.yml action, a worker that runs every minute will be deployed on Cloudflare.

The steps to use this project are: fork -> create secrets -> run deploy.yml.

Before executing the deploy.yml action, you must create six secrets: CF_ACCOUNT_ID、CF_API_TOKEN、CF_WORKER_NAME will be used to deploy the worker on Cloudflare. YUNZIYUAN_HOST、YUNZIYUAN_EXPLORER and YUNZIYUAN_TOKEN are authentication information that the worker needs when retrieving tasks from the server.

Below are the ways to obtain these six secrets:

CF_ACCOUNT_ID：After logging into your Cloudflare account，obtain it from the address bar on the dashboard page，e.g., for https://dash.cloudflare.com/[account id], the account id part.

CF_API_TOKEN： Click on the profile icon in the top right corner, then go to My profile -> API Tokens -> Create Token -> Edit Cloudflare Workers (Use Template) -> Include All accounts (Account Resources) && Include All zones (Zone Resources) -> Continue to summary -> Create Token.

CF_WORKER_NAME: Name of the deployed worker, e.g., cf_explore_share_001.

YUNZIYUAN_HOST: Server to get tasks from, must be set to share.sevenkingdoms.eu.org.

YUNZIYUAN_TOKEN: Go to the https://share.sevenkingdoms.eu.org, enter your email address in the keywords field, and press enter. Later, retrieve the token from your email.

YUNZIYUAN_EXPLORER： This is the email address you provided when obtaining the YUNZIYUAN_TOKEN.

If you need to deploy multiple workers, please change CF_WORKER_NAME before running the deploy.yml action, such as cf_explore_share_002.

Due to Cloudflare's limit on the number of scheduled workers, you can deploy a maximum of six workers. 