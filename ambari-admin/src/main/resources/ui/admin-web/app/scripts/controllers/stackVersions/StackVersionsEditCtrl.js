/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ambariAdminConsole')
.controller('StackVersionsEditCtrl', ['$scope', '$location', 'Cluster', 'Stack', '$routeParams', 'ConfirmationModal', 'Alert', function($scope, $location, Cluster, Stack, $routeParams, ConfirmationModal, Alert) {
  $scope.loadStackVersionInfo = function () {
    return Stack.getRepo($routeParams.versionId, $routeParams.stackName).then(function (response) {
      $scope.id = response.id;
      $scope.stack = response.stack;
      $scope.stackName = response.stackName;
      $scope.versionName = response.versionName;
      $scope.stackVersion = response.stackVersion;
      $scope.updateObj = response.updateObj;
      //save default values of repos to check if they were changed
      $scope.defaulfOSRepos = {};
      response.updateObj.operating_systems.forEach(function(os) {
        $scope.defaulfOSRepos[os.OperatingSystems.os_type] = {
          defaultBaseUrl: os.repositories[0].Repositories.base_url,
          defaultUtilsUrl: os.repositories[1].Repositories.base_url
        };
      });
      $scope.repoVersionFullName = response.repoVersionFullName;
      angular.forEach(response.osList, function (os) {
        os.selected = true;
      });
      $scope.osList = response.osList;
      // if user reach here from UI click, repo status should be cached
      // otherwise re-fetch repo status from cluster end point.
      $scope.repoStatus = Cluster.repoStatusCache[$scope.id];
      if (!$scope.repoStatus) {
        $scope.fetchClusters()
        .then(function () {
          return $scope.fetchRepoClusterStatus();
        })
        .then(function () {
          $scope.deleteEnabled = $scope.isDeletable();
        });
      } else {
        $scope.deleteEnabled = $scope.isDeletable();
      }
      $scope.addMissingOSList();
    });
  };

  $scope.isDeletable = function() {
    return !($scope.repoStatus == 'current' || $scope.repoStatus == 'installed');
  };

  $scope.addMissingOSList = function() {
    Stack.getSupportedOSList($scope.stackName, $scope.stackVersion)
    .then(function (data) {
      var existingOSHash = {};
      angular.forEach($scope.osList, function (os) {
        existingOSHash[os.OperatingSystems.os_type] = os;
      });
      //TODO map data.operating_systems after API is fixed
      var operatingSystems = data.operating_systems || data.operatingSystems;
      var osList = operatingSystems.map(function (os) {
        return existingOSHash[os.OperatingSystems.os_type] || {
          OperatingSystems: {
            os_type : os.OperatingSystems.os_type
          },
          repositories: [
            {
              Repositories: {
                base_url: '',
                repo_id: 'HDP-' + $routeParams.versionId,
                repo_name: 'HDP'
              }
            },
            {
              Repositories: {
                base_url: '',
                repo_id: 'HDP-UTILS-' + $routeParams.versionId,
                repo_name: 'HDP-UTILS'
              }
            }
          ],
          selected: false
        };
      });
      $scope.osList = osList;
    })
    .catch(function (data) {
      Alert.error('getSupportedOSList error', data.message);
    });
  }

  $scope.defaulfOSRepos = {};

  $scope.skipValidation = false;

  $scope.save = function () {
    $scope.editVersionDisabled = true;
    delete $scope.updateObj.href;
    $scope.updateObj.operating_systems = [];
    var updateRepoUrl = false;
    angular.forEach($scope.osList, function (os) {
      var savedUrls = $scope.defaulfOSRepos[os.OperatingSystems.os_type];
      if (os.selected) {
        var currentRepos = os.repositories;
        if (currentRepos[0].Repositories.base_url != savedUrls.defaultBaseUrl
            || currentRepos[1].Repositories.base_url != savedUrls.defaultUtilsUrl) {
          updateRepoUrl = true;
        }
        $scope.updateObj.operating_systems.push(os);
      } else if (savedUrls) {
        updateRepoUrl = true;
      }
    });
    if (updateRepoUrl && !$scope.deleteEnabled) {
      ConfirmationModal.show('Confirm Base URL Change', 'You are about to change repository Base URLs that are already in use. Please confirm that you intend to make this change and that the new Base URLs point to the same exact Stack version and build', "Confirm Change").then(function() {
        $scope.updateRepoVersions();
      });
    } else {
      $scope.updateRepoVersions();
    }
  };

  $scope.updateRepoVersions = function () {
    Stack.updateRepo($scope.stackName, $scope.stackVersion, $scope.id, $scope.updateObj).then(function () {
      Alert.success('Edited version <a href="#/stackVersions/' + $scope.stackName + '/' + $scope.versionName + '/edit">' + $scope.repoVersionFullName + '</a>');
      $location.path('/stackVersions');
    }).catch(function (data) {
      Alert.error('Version update error', data.message);
    });
  };

  $scope.cancel = function () {
    $scope.editVersionDisabled = true;
    $location.path('/stackVersions');
  };

  $scope.fetchRepoClusterStatus = function () {
    var clusterName = $scope.clusters[0].Clusters.cluster_name; // only support one cluster at the moment
    return Cluster.getRepoVersionStatus(clusterName, $scope.id).then(function (response) {
      $scope.repoStatus = response.status;
    });
  };

  $scope.fetchClusters = function () {
    return Cluster.getAllClusters().then(function (clusters) {
      $scope.clusters = clusters;
    });
  };

  $scope.delete = function () {
    ConfirmationModal.show('Delete Version', 'Are you sure you want to delete version "'+ $scope.versionName +'"?').then(function() {
      Stack.deleteRepo($scope.stackName, $scope.stackVersion, $scope.id).then( function () {
        $location.path('/stackVersions');
      }).catch(function (data) {
        Alert.error('Version delete error', data.message);
      });
    });
  };
  $scope.loadStackVersionInfo();
}]);
