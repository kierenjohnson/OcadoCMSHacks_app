"use strict";

function DataFactory($http) {

    var urlBase = 'http://change.ocado.com/change/ws/v2/';
    var dataFactory = {};

    function getConfig(basicAuthToken, cache) {
      cache = typeof cache !== 'undefined' ? cache : false;
      return {
        headers: {
          'Authorization': basicAuthToken
        },
        cache: cache
      };
    }

    dataFactory.getUsers = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'users', getConfig(basicAuthToken, cache));
    };

    dataFactory.getSystems = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'systems', getConfig(basicAuthToken, cache));
    };

    dataFactory.getStatuses = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'statuses', getConfig(basicAuthToken, cache));
    };

    dataFactory.getSystemAuthorisers = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'systemAuthorisers', getConfig(basicAuthToken, cache));
    };

    dataFactory.getCR = function (id, basicAuthToken, cache) {
      return $http.get(urlBase + 'changes/' + id, getConfig(basicAuthToken, cache));
    };

    dataFactory.getCRs = function (systemId, status, basicAuthToken, cache) {
      var url = urlBase + 'changes?query=system=' + systemId + '!status=' + status + '!limit=20!after=18/06/2014_12:00';
      return $http.get(url, getConfig(basicAuthToken, cache));
    };

    dataFactory.updateCRStatus = function (id, action, basicAuthToken, cache) {
      return $http.put(urlBase + 'changes/' + id + '/statuses', {'action': action}, getConfig(basicAuthToken, cache));
    };

    dataFactory.rescheduleCR = function (id, actionAt, basicAuthToken) {
      return $http.put(urlBase + 'changes/' + id, {'actionAt': actionAt}, getConfig(basicAuthToken));
    };

    return dataFactory;
}
