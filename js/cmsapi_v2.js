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

    dataFactory.getTeamUsers = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'teamUsers', getConfig(basicAuthToken, cache));
    };

    dataFactory.getSystemManagers = function (basicAuthToken, cache) {
      return $http.get(urlBase + 'systemManagers', getConfig(basicAuthToken, cache));
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

    dataFactory.updateCRStatus = function (id, data, basicAuthToken, cache) {
      return $http.put(urlBase + 'changes/' + id + '/statuses', data, getConfig(basicAuthToken, cache));
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
    confirmationStatus: entry.confirmationStatus,
    comments: entry.comments,
    authorisedBy: getById(Session.users, entry.authorisedBy, 'realName', '').realName,
    signedOffBy: getById(Session.users, entry.signedOffBy, 'realName', '').realName,
    listHtml: '<strong>' + entry.title + '</strong><br/>' +
    'Action: ' + formatDate(new Date(entry.actionAt*1000), 'd-MMM-yyyy HH:mm') + '<br/>Raiser: ' + getById(Session.users, entry.raisedBy).realName
  }
}

function initialiseSession($scope, dataFactory, Session, callback) {

  $scope.fetchUsers = function() {
    dataFactory.getUsers(Session.basicAuthToken, true).
      success(
        function (resp, status, headers, config) {
          Session.users = resp.users;
          var u = getUserByUserName(Session.users, Session.userName);
          Session.cmsUserId = u.id;
          Session.realName = u.realName;
          if (Session.userName == 'kieren.johnson') {
            Session.realName = 'The Dude';
          }
          $scope.$parent.signedInAs = Session.realName;

          $scope.fetchStatuses();
        }
      ).
      error(function(err) {
      // TODO: Handle error
    });
  }

  $scope.fetchStatuses = function() {
    dataFactory.getStatuses(Session.basicAuthToken, true).
      success(function(resp, status, headers, config) {
        Session.statuses = resp.changeStatuses;
        $scope.fetchSystems();
      }).
      error(function(err) {
      // TODO: Handle error
    });
  }

  $scope.fetchSystems = function() {
    dataFactory.getSystems(Session.basicAuthToken, true).
      success(function(resp, status, headers, config) {
        Session.systems = resp.systems;
        $scope.fetchTeams();
      }).
      error(function(err) {
      // TODO: Handle error
    });
  }


  $scope.fetchTeams = function() {
    dataFactory.getTeams(Session.basicAuthToken, true).
      success(function(resp, status, headers, config) {
        Session.teams = resp.teams;
        $scope.fetchSystemManagers();
      }).
      error(function(err) {
      // TODO: Handle error
    });
  }

  $scope.fetchSystemManagers = function() {
    dataFactory.getSystemManagers(Session.basicAuthToken, true).
    success(function(resp, status, headers, config) {
      Session.systemManagers = resp.systemManagers;

      // identify the systems that this user is a manager of
      var systems = [];
      resp.systemManagers.forEach(function(entry, i) {
        // search for our userId
        entry.managers.forEach(function(e, j) {
          if (e == Session.cmsUserId) {
            systems.push(entry.systemId);
          }
        });
      });
      Session.signOffSystemIds = systems;

      $scope.fetchAuthorisingSystems();
    }).
    error(function(err) {
    // TODO: Handle error
    });
  }

  $scope.fetchAuthorisingSystems = function() {
    dataFactory.getSystemAuthorisers(Session.basicAuthToken, true).
      success(function (resp, status, headers, config) {

        // identify the systems that this user is an authoriser of
        var systems = [];
        resp.systemAuthorisers.forEach(function(entry, i) {
          // search for our userId
          entry.authorisers.forEach(function(e, j) {
            if (e == Session.cmsUserId) {
              systems.push(entry.systemId);
            }
          });
        });

        Session.authorisingSystemIds = systems;

        callback();
      }).
      error(function(err) {
      // TODO: Handle error
    });
  }

  $scope.fetchUsers();

}
