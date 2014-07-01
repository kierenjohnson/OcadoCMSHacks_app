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

    dataFactory.getTeams = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'teams', getConfig(basicAuthToken, cache));
    };

    dataFactory.getSystemAuthorisers = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'systemAuthorisers', getConfig(basicAuthToken, cache));
    };

    dataFactory.getCR = function (id, basicAuthToken, cache) {
      return $http.get(urlBase + 'changes/' + id, getConfig(basicAuthToken, cache));
    };

    dataFactory.getTask = function (id, basicAuthToken, cache) {
      return $http.get(urlBase + 'tasks/' + id, getConfig(basicAuthToken, cache));
    };

    dataFactory.getCRs = function (options, basicAuthToken, cache) {
      var url = urlBase + 'changes?query=system=' + options.systemId + '!status=' + options.status;
      if (options.afterDate) {
        url = url + '!after=' + formatDate(new Date(options.afterDate), 'dd/MM/yyyy_HH:mm');
      }
      return $http.get(url, getConfig(basicAuthToken, cache));
    };

    dataFactory.updateCRStatus = function (id, action, basicAuthToken, cache) {
      return $http.put(urlBase + 'changes/' + id + '/statuses', {'action': action}, getConfig(basicAuthToken, cache));
    };

    dataFactory.rescheduleCR = function (id, actionAt, basicAuthToken) {
      return $http.put(urlBase + 'changes/' + id, {'actionAt': actionAt}, getConfig(basicAuthToken));
    };

    dataFactory.updateCR = function(cr, basicAuthToken) {
      return $http.post(urlBase + 'changes/createEditChangeAction', cr, getConfig(basicAuthToken));
    };

    return dataFactory;
}

function loadTask(entry, Session) {
  return {
    id: entry.id,
    title: entry.title,
    actionDate: entry.actionAt*1000,
    status: getById(Session.statuses, entry.status).description,
    statusCode: entry.status,
    raisedBy: getById(Session.users, entry.raisedBy).realName,
    details: entry.details,
    system: getById(Session.systems, entry.systemId).systemName,
    team: getById(Session.teams, entry.teamId).teamName,
    backout: entry.backout,
    changeId: entry.changeId
  }
}

function loadTasks(tasks, Session) {
  var result = [];
  for (i = 0; i < tasks.length; i++) {
    result.push(loadTask(tasks[i], Session));
  }
  return result;
}

function loadCR(entry, Session) {
  return {
    id: entry.id,
    title: entry.title,
    actionDate: entry.actionAt*1000,
    raisedAt: entry.raisedAt*1000,
    status: getById(Session.statuses, entry.status).description,
    statusCode: entry.status,
    raisedBy: getById(Session.users, entry.raisedBy).realName,
    details: entry.details,
    system: getById(Session.systems, entry.systemId).systemName,
    businessReason: entry.businessReason,
    impact: entry.impact,
    tasks: loadTasks(entry.tasks, Session),
    listHtml: '<strong>' + entry.title + '</strong><br/>' +
    'Action: ' + formatDate(new Date(entry.actionAt*1000), 'd-MMM-yyyy HH:mm') + '<br/>Raiser: ' + getById(Session.users, entry.raisedBy).realName
  }
}
