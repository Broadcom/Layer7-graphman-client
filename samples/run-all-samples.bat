@echo off

graphman.bat import --input samples\activeconnector\entities.json --gateway source-gateway
graphman.bat import --input samples\activeconnector\entities.json --gateway target-gateway
graphman.bat export --using activeConnectors --gateway source-gateway --output build\source\activeconnector\entities.json
graphman.bat export --using activeConnectors --gateway target-gateway --output build\target\activeconnector\entities.json
graphman.bat diff --input-source build\source\activeconnector\entities.json --input-target build\target\activeconnector\entities.json
echo --------------------------------------------

graphman.bat import --input samples\cassandraconnection\entities.json --gateway source-gateway
graphman.bat import --input samples\cassandraconnection\entities.json --gateway target-gateway
graphman.bat export --using cassandraConnections --gateway source-gateway --output build\source\cassandraconnection\entities.json
graphman.bat export --using cassandraConnections --gateway target-gateway --output build\target\cassandraconnection\entities.json
graphman.bat diff --input-source build\source\cassandraconnection\entities.json --input-target build\target\cassandraconnection\entities.json
echo --------------------------------------------

graphman.bat import --input samples\clusterproperty\entities.json --gateway source-gateway
graphman.bat import --input samples\clusterproperty\entities.json --gateway target-gateway
graphman.bat export --using clusterProperties --gateway source-gateway --output build\source\clusterproperty\entities.json
graphman.bat export --using clusterProperties --gateway target-gateway --output build\target\clusterproperty\entities.json
graphman.bat diff --input-source build\source\clusterproperty\entities.json --input-target build\target\clusterproperty\entities.json
echo --------------------------------------------

graphman.bat import --input samples\customkeyvalue\entities.json --gateway source-gateway
graphman.bat import --input samples\customkeyvalue\entities.json --gateway target-gateway
graphman.bat export --using customKeyValues --gateway source-gateway --output build\source\customkeyvalue\entities.json
graphman.bat export --using customKeyValues --gateway target-gateway --output build\target\customkeyvalue\entities.json
graphman.bat diff --input-source build\source\customkeyvalue\entities.json --input-target build\target\customkeyvalue\entities.json
echo --------------------------------------------

graphman.bat import --input samples\firewallrule\entities.json --gateway source-gateway
graphman.bat import --input samples\firewallrule\entities.json --gateway target-gateway
graphman.bat export --using firewallRules --gateway source-gateway --output build\source\firewallrule\entities.json
graphman.bat export --using firewallRules --gateway target-gateway --output build\target\firewallrule\entities.json
graphman.bat diff --input-source build\source\firewallrule\entities.json --input-target build\target\firewallrule\entities.json
echo --------------------------------------------

graphman.bat import --input samples\folder\entities.json --gateway source-gateway
graphman.bat import --input samples\folder\entities.json --gateway target-gateway
graphman.bat export --using folders --gateway source-gateway --output build\source\folder\entities.json
graphman.bat export --using folders --gateway target-gateway --output build\target\folder\entities.json
graphman.bat diff --input-source build\source\folder\entities.json --input-target build\target\folder\entities.json
echo --------------------------------------------

graphman.bat import --input samples\genericentity\entities.json --gateway source-gateway
graphman.bat import --input samples\genericentity\entities.json --gateway target-gateway
graphman.bat export --using genericEntities --gateway source-gateway --output build\source\genericentity\entities.json
graphman.bat export --using genericEntities --gateway target-gateway --output build\target\genericentity\entities.json
graphman.bat diff --input-source build\source\genericentity\entities.json --input-target build\target\genericentity\entities.json
echo --------------------------------------------

graphman.bat import --input samples\globalresource\entities.json --gateway source-gateway
graphman.bat import --input samples\globalresource\entities.json --gateway target-gateway
graphman.bat export --using globalResources --gateway source-gateway --output build\source\globalresource\entities.json
graphman.bat export --using globalResources --gateway target-gateway --output build\target\globalresource\entities.json
graphman.bat diff --input-source build\source\globalresource\entities.json --input-target build\target\globalresource\entities.json
echo --------------------------------------------

graphman.bat import --input samples\httpconfiguration\entities.json --gateway source-gateway
graphman.bat import --input samples\httpconfiguration\entities.json --gateway target-gateway
graphman.bat export --using httpConfigurations --gateway source-gateway --output build\source\httpconfiguration\entities.json
graphman.bat export --using httpConfigurations --gateway target-gateway --output build\target\httpconfiguration\entities.json
graphman.bat diff --input-source build\source\httpconfiguration\entities.json --input-target build\target\httpconfiguration\entities.json
echo --------------------------------------------

graphman.bat import --input samples\interfacetag\entities.json --gateway source-gateway
graphman.bat import --input samples\interfacetag\entities.json --gateway target-gateway
graphman.bat export --using interfaceTags --gateway source-gateway --output build\source\interfacetag\entities.json
graphman.bat export --using interfaceTags --gateway target-gateway --output build\target\interfacetag\entities.json
graphman.bat diff --input-source build\source\interfacetag\entities.json --input-target build\target\interfacetag\entities.json
echo --------------------------------------------

graphman.bat import --input samples\key\entities.json --gateway source-gateway
graphman.bat import --input samples\key\entities.json --gateway target-gateway
graphman.bat export --using keys --gateway source-gateway --output build\source\key\entities.json
graphman.bat export --using keys --gateway target-gateway --output build\target\key\entities.json
graphman.bat diff --input-source build\source\key\entities.json --input-target build\target\key\entities.json
echo --------------------------------------------

graphman.bat import --input samples\listenport\entities.json --gateway source-gateway
graphman.bat import --input samples\listenport\entities.json --gateway target-gateway
graphman.bat export --using listenPorts --gateway source-gateway --output build\source\listenport\entities.json
graphman.bat export --using listenPorts --gateway target-gateway --output build\target\listenport\entities.json
graphman.bat diff --input-source build\source\listenport\entities.json --input-target build\target\listenport\entities.json
echo --------------------------------------------

graphman.bat import --input samples\logsink\entities.json --gateway source-gateway
graphman.bat import --input samples\logsink\entities.json --gateway target-gateway
graphman.bat export --using logSinks --gateway source-gateway --output build\source\logsink\entities.json
graphman.bat export --using logSinks --gateway target-gateway --output build\target\logsink\entities.json
graphman.bat diff --input-source build\source\logsink\entities.json --input-target build\target\logsink\entities.json
echo --------------------------------------------

graphman.bat import --input samples\policy\entities.json --gateway source-gateway
graphman.bat import --input samples\policy\entities.json --gateway target-gateway
graphman.bat export --using policies --gateway source-gateway --output build\source\policy\entities.json
graphman.bat export --using policies --gateway target-gateway --output build\target\policy\entities.json
graphman.bat diff --input-source build\source\policy\entities.json --input-target build\target\policy\entities.json
echo --------------------------------------------

graphman.bat import --input samples\policybackedservice\entities.json --gateway source-gateway
graphman.bat import --input samples\policybackedservice\entities.json --gateway target-gateway
graphman.bat export --using policyBackedServices --gateway source-gateway --output build\source\policybackedservice\entities.json
graphman.bat export --using policyBackedServices --gateway target-gateway --output build\target\policybackedservice\entities.json
graphman.bat diff --input-source build\source\policybackedservice\entities.json --input-target build\target\policybackedservice\entities.json
echo --------------------------------------------

graphman.bat import --input samples\revocationcheckpolicy\entities.json --gateway source-gateway
graphman.bat import --input samples\revocationcheckpolicy\entities.json --gateway target-gateway
graphman.bat export --using revocationCheckPolicies --gateway source-gateway --output build\source\revocationcheckpolicy\entities.json
graphman.bat export --using revocationCheckPolicies --gateway target-gateway --output build\target\revocationcheckpolicy\entities.json
graphman.bat diff --input-source build\source\revocationcheckpolicy\entities.json --input-target build\target\revocationcheckpolicy\entities.json
echo --------------------------------------------

graphman.bat import --input samples\samplemessage\entities.json --gateway source-gateway
graphman.bat import --input samples\samplemessage\entities.json --gateway target-gateway
graphman.bat export --using sampleMessages --gateway source-gateway --output build\source\samplemessage\entities.json
graphman.bat export --using sampleMessages --gateway target-gateway --output build\target\samplemessage\entities.json
graphman.bat diff --input-source build\source\samplemessage\entities.json --input-target build\target\samplemessage\entities.json
echo --------------------------------------------

graphman.bat import --input samples\securityzone\entities.json --gateway source-gateway
graphman.bat import --input samples\securityzone\entities.json --gateway target-gateway
graphman.bat export --using securityZones --gateway source-gateway --output build\source\securityzone\entities.json
graphman.bat export --using securityZones --gateway target-gateway --output build\target\securityzone\entities.json
graphman.bat diff --input-source build\source\securityzone\entities.json --input-target build\target\securityzone\entities.json
echo --------------------------------------------

graphman.bat import --input samples\service\entities.json --gateway source-gateway
graphman.bat import --input samples\service\entities.json --gateway target-gateway
graphman.bat export --using services --gateway source-gateway --output build\source\service\entities.json
graphman.bat export --using services --gateway target-gateway --output build\target\service\entities.json
graphman.bat diff --input-source build\source\service\entities.json --input-target build\target\service\entities.json
echo --------------------------------------------

graphman.bat import --input samples\sniconfiguration\entities.json --gateway source-gateway
graphman.bat import --input samples\sniconfiguration\entities.json --gateway target-gateway
graphman.bat export --using sniConfigurations --gateway source-gateway --output build\source\sniconfiguration\entities.json
graphman.bat export --using sniConfigurations --gateway target-gateway --output build\target\sniconfiguration\entities.json
graphman.bat diff --input-source build\source\sniconfiguration\entities.json --input-target build\target\sniconfiguration\entities.json
echo --------------------------------------------

graphman.bat import --input samples\trustedcert\entities.json --gateway source-gateway
graphman.bat import --input samples\trustedcert\entities.json --gateway target-gateway
graphman.bat export --using trustedCerts --gateway source-gateway --output build\source\trustedcert\entities.json
graphman.bat export --using trustedCerts --gateway target-gateway --output build\target\trustedcert\entities.json
graphman.bat diff --input-source build\source\trustedcert\entities.json --input-target build\target\trustedcert\entities.json
echo --------------------------------------------
