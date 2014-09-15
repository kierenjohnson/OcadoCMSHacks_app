/* jshint undef: true, unused: true */
/* global formatDate, getById, getUserByUserName */

function DataFactory($http) {
    'use strict';

    var urlBase = 'https://change.ocado.com/change/ws/v2/';
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

    dataFactory.getPreReqTask = function (id, basicAuthToken, cache) {
      return $http.get(urlBase + 'prereqTasks/' + id, getConfig(basicAuthToken, cache));
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
  };
}

function loadTasks(tasks, Session) {
  var result = [];
  for (var j = 0; j < tasks.length; j++) {
    result.push(loadTask(tasks[j], Session));
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
    preRequisiteTasks: loadTasks(entry.prerequisiteTasks, Session),
    confirmationStatus: entry.confirmationStatus,
    comments: entry.comments,
    authorisedBy: getById(Session.users, entry.authorisedBy, 'realName', '').realName,
    signedOffBy: getById(Session.users, entry.signedOffBy, 'realName', '').realName,
    listHtml: '<strong>' + entry.title + '</strong><br/>' +
    'Action: ' + formatDate(new Date(entry.actionAt*1000), 'd-MMM-yyyy HH:mm') + '<br/>Raiser: ' + getById(Session.users, entry.raisedBy).realName
  };
}

function initialiseSession($scope, dataFactory, Session, callback) {

  // nb Removed caching from getUsers as it allows us to catch
  // authentication failures on the first request
  $scope.fetchUsers = function() {
    dataFactory.getUsers(Session.basicAuthToken, false).
      success(
        function (resp) {
          Session.users = resp.users;
          var u = getUserByUserName(Session.users, Session.userName);

          // if username was not found then we need to throw an error
          if (typeof u == 'undefined') {
            $scope.$broadcast('ERR_USERNAME_NOT_FOUND', Session.userName);
          } else {
            Session.cmsUserId = u.id;
            Session.realName = u.realName;
            if (Session.userName == 'kieren.johnson') {
              Session.realName = 'The Dude';
            }
            $scope.$parent.signedInAs = Session.realName;

            $scope.fetchStatuses();
          }
        }
      ).
      error(function() {
      // TODO: Handle error
    });
  };

  $scope.fetchStatuses = function() {
    dataFactory.getStatuses(Session.basicAuthToken, true).
      success(function(resp) {
        Session.statuses = resp.changeStatuses;
        $scope.fetchSystems();
      }).
      error(function() {
      // TODO: Handle error
    });
  };

  $scope.fetchSystems = function() {
    dataFactory.getSystems(Session.basicAuthToken, true).
      success(function(resp) {
        Session.systems = resp.systems;
        $scope.fetchTeams();
      }).
      error(function() {
      // TODO: Handle error
    });
  };


  $scope.fetchTeams = function() {
    dataFactory.getTeams(Session.basicAuthToken, true).
      success(function(resp) {
        Session.teams = resp.teams;
        $scope.fetchSystemManagers();
      }).
      error(function() {
      // TODO: Handle error
    });
  };

  $scope.fetchSystemManagers = function() {
    dataFactory.getSystemManagers(Session.basicAuthToken, true).
    success(function(resp) {
      Session.systemManagers = resp.systemManagers;

      // identify the systems that this user is a manager of
      var systems = [];
      resp.systemManagers.forEach(function(entry) {
        // search for our userId
        entry.managers.forEach(function(e) {
          if (e == Session.cmsUserId) {
            systems.push(entry.systemId);
          }
        });
      });
      Session.signOffSystemIds = systems;

      $scope.fetchAuthorisingSystems();
    }).
    error(function() {
    // TODO: Handle error
    });
  };

  $scope.fetchAuthorisingSystems = function() {
    dataFactory.getSystemAuthorisers(Session.basicAuthToken, true).
      success(function (resp) {

        // identify the systems that this user is an authoriser of
        var systems = [];
        resp.systemAuthorisers.forEach(function(entry) {
          // search for our userId
          entry.authorisers.forEach(function(e) {
            if (e == Session.cmsUserId) {
              systems.push(entry.systemId);
            }
          });
        });

        Session.authorisingSystemIds = systems;

        callback();
      }).
      error(function() {
      // TODO: Handle error
    });
  };

  $scope.fetchUsers();

}
