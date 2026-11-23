
# Previous Releases

## Install the graphman client using the git release distributions
Download one of the released [Graphman client distributions](https://github.com/Broadcom/Layer7-graphman-client/releases), and follow the below steps to install the client:
- unzip the wrapper archive
    - `tar -xvf layer7-graphman-wrapper.tar.gz`
- cd to the wrapper directory
    - `cd /path/to/layer7-graphman-wrapper`
- install the **@layer7/graphman** npm module
    - `npm install layer7-graphman-<version>.tgz`
- set the environment variable **GRAPHMAN_HOME** to the path where this wrapper is unzipped.
    - `export GRAPHMAN_HOME=/path/to/layer7-graphman-wrapper`
- verify the installation by running the version command
    - `graphman.sh version` 

> [!TIP]
> Use platform specific entrypoint to interact with the GRAPHMAN.
>
> - Windows - graphman.bat
> - Linux - graphman.sh