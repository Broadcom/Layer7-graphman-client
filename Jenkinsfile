@Library('apim-jenkins-lib@master') _

pipeline {
    agent { label 'default' }
    environment {
        ARTIFACTORY_CREDS = credentials('ARTIFACTORY_USERNAME_TOKEN')
        ARTIFACTORY_ARTIFACT_PATH = 'usw1.packages.broadcom.com/artifactory'
        ARTIFACTORY_ARTIFACT_NPM_DEV_PATH = "${env.ARTIFACTORY_ARTIFACT_PATH}/api/npm/apim-npm-dev-local/"
        ARTIFACTORY_ARTIFACT_NPM_RELEASE_PATH = "${env.ARTIFACTORY_ARTIFACT_PATH}/api/npm/apim-npm-release-local/"
        ARTIFACTORY_UPLOAD_PATH = "${env.ARTIFACTORY_ARTIFACT_PATH}/apim-npm-dev-local/graphman-cli/"
        ARTIFACTORY_EMAIL = 'bld-apim.teamcity@broadcom.com'
    }
    parameters {
        string(name: 'VAR_jdk_version', defaultValue: 'jdk11.0.18_10', description: 'JDK Version')
        booleanParam(
            defaultValue: false,
            description: 'true to publish the build artifacts to the artifactory.',
            name: 'PUBLISH_TO_ARTIFACTORY'
        )
        string(
            name: 'CUSTOM_BUILD_NUMBER',
            defaultValue: '',
            description: 'Optional override for the build number used in the package version. Leave blank to use the Jenkins BUILD_NUMBER.'
        )
    }
    stages {
        stage('Update Java') {
             steps {
                 script {
                     sh 'java -version'
                     sh 'cd /usr/java; rm -rf default; ln -s ${VAR_jdk_version} default'
                     sh 'cd /usr/java; rm -rf latest; ln -s ${VAR_jdk_version} latest'
                     jdk_path="/usr/java/${VAR_jdk_version}"
                     sh 'java -version'
                  }
              }
         }
        stage("Build") {
            steps {
                echo "Building graphman-client ..."
                script {
                    def customBuildNumber = params.CUSTOM_BUILD_NUMBER?.trim()
                    def effectiveBuildNumber = customBuildNumber ? customBuildNumber : env.BUILD_NUMBER
                    if (!(effectiveBuildNumber ==~ /^[0-9]+$/)) {
                        error("CUSTOM_BUILD_NUMBER must be numeric, got: ${effectiveBuildNumber}")
                    }
                    withEnv(["EFFECTIVE_BUILD_NUMBER=${effectiveBuildNumber}"]) {
                        sh './build.sh $EFFECTIVE_BUILD_NUMBER $BRANCH_NAME'
                    }
                    sh "mkdir -p BuildArtifact"
                    sh "du -h"
                    sh "cp ./build/dist/layer7-graphman-* BuildArtifact"
                }
            }
        }
        stage('Publish to Artifactory') {
            when { expression { params.PUBLISH_TO_ARTIFACTORY }}
            steps {
                sh '''
                   echo prepare per-project npmrc file
                   export ARTIFACTORY_ARTIFACT_NPM_PATH=$ARTIFACTORY_ARTIFACT_NPM_DEV_PATH
                   if [[ $BRANCH_NAME == release/v* ]]; then export ARTIFACTORY_ARTIFACT_NPM_PATH=$ARTIFACTORY_ARTIFACT_NPM_RELEASE_PATH; fi
                   artifactoryCredentials=$(echo -n $ARTIFACTORY_CREDS_USR:$ARTIFACTORY_CREDS_PSW|base64 --wrap=0)
                   echo registry=https://$ARTIFACTORY_ARTIFACT_NPM_PATH > ./.npmrc
                   echo //$ARTIFACTORY_ARTIFACT_NPM_PATH:_auth=$artifactoryCredentials >> ./.npmrc
                   echo email=$ARTIFACTORY_EMAIL >> ./.npmrc
                   echo always-auth=true >> ./.npmrc
                   cat ./.npmrc

                   echo start publishing the artifacts
                   layer7Graphman=$(ls -d ./build/dist/layer7-graphman-*.tgz)
                   npm publish ${layer7Graphman} --registry https://${ARTIFACTORY_ARTIFACT_NPM_PATH}
                   rm -rf ./.npmrc
                   '''
                echo "published Graphman-client artifacts to artifactory"
           }
       }
    }

    post {
        always {
          script {
               archiveArtifacts artifacts: "BuildArtifact/**/*", allowEmptyArchive: true
          }
          echo "end"
       }
   }
}
