// define the application
var cmsHacksApp = angular.module('cmsHacksApp', ['ngRoute','ngSanitize']);

//
cmsHacksApp.factory('dataFactory', ['$http', function($http) {
  var dataFactory = new DataFactory($http);
  return dataFactory;
}]);

// google anayltics tracker factory
cmsHacksApp.factory('analyticsTracker', function() {

  // initialise google analytics service object
  service = analytics.getService('cms_hacks_app');
  //service.getConfig().addCallback(initAnalyticsConfig);

  // Get a Tracker using your Google Analytics app Tracking ID.
  return tracker = service.getTracker('UA-27869830-5');
});


// singleton service for storing session variables
cmsHacksApp.service('Session', function () {
  this.create = function (userName, realName, cmsUserId, authorisingSystemIds, basicAuthToken, users, systems) {
    this.userName = userName;
    this.realName = realName;
    this.cmsUserId = cmsUserId;
    this.authorisingSystemIds = authorisingSystemIds;  // ids of systems this user authorises
    this.basicAuthToken = basicAuthToken;
    this.users = users; // all users of the system (needed to lookup raisers etc)
    this.systems = systems; // all cms systems
    this.statuses = statuses; // all cms status codes
    this.teams = teams; // all cms teams
  };
  this.destroy = function () {
    this.userName = null;
    this.cmsUserId = null;
    this.realName = null;
    this.authorisingSystemIds = null;
    this.basicAuthToken = null;
    this.users = null;
    this.systems = null;
    this.statuses = null;
    this.teams = null;
  };
  return this;
});

// define constants for authentication issues
cmsHacksApp.constant('AUTH_EVENTS', {
  loginSuccess: 'auth-login-success',
  loginFailed: 'auth-login-failed',
  logoutSuccess: 'auth-logout-success',
  sessionTimeout: 'auth-session-timeout',
  notAuthenticated: 'auth-not-authenticated',
  notAuthorized: 'auth-not-authorized'
});

// create an authentication interceptor
cmsHacksApp.config(function ($httpProvider) {
  $httpProvider.interceptors.push([
    '$injector',
    function ($injector) {
      return $injector.get('AuthInterceptor');
    }
  ]);
});

cmsHacksApp.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
  return {
    responseError: function (response) {
      if (response.status === 401) {
        $rootScope.$broadcast(AUTH_EVENTS.notAuthenticated,
                              response);
      }
      if (response.status === 403) {
        $rootScope.$broadcast(AUTH_EVENTS.notAuthorized,
                              response);
      }
      if (response.status === 419 || response.status === 440) {
        $rootScope.$broadcast(AUTH_EVENTS.sessionTimeout,
                              response);
      }
      return $q.reject(response);
    }
  };
});

cmsHacksApp.controller('MainController', function($scope, $rootScope, $location, analyticsTracker, AUTH_EVENTS) {

  // initialise loading spinner display to false
  $scope.loading = false;

  $scope.query = {
    crId: ''
  };

  $scope.isLoggedIn = function() {
    return ($location.path() != '/');
  }

  $scope.search = function(query) {
    if (query.crId) {
      analyticsTracker.sendEvent('Action', 'Search');
      // redirect
      $rootScope.$broadcast('VIEW_CR_DETAIL', query.crId);
      $location.path('/changes/' + query.crId);
    }
  }

  $scope.$on(AUTH_EVENTS.notAuthenticated, function(event, mass) {
    console.log(mass)
  });

});

// Controller for the login page
// Capture login event, store session variables and
// change page to the crsList
cmsHacksApp.controller('LoginController',function($scope, $rootScope, $location, Session, analyticsTracker, AUTH_EVENTS) {

  // Record an "appView" each time the user launches your app or goes to a new
  // screen within the app.
  analyticsTracker.sendAppView('LoginView');

  $scope.credentials = {
    username: '',
    password: ''
  };

  chrome.storage.local.get('cmsUserName', function(obj) {
    $scope.credentials.username = obj.cmsUserName;
    if(!$scope.$$phase) {
      $scope.$apply(function($scope){
        $('#password').focus();
      });
    }
  });

  // $scope.credentials.username = localStorage.cmsUserName;
  if(!$scope.$$phase) {
    $scope.$apply(function($scope){
      $('#password').focus();
    });
  }


  $scope.login = function(credentials) {

    analyticsTracker.sendEvent('Action', 'Login');

    Session.userName = credentials.username;
    Session.basicAuthToken = btoa(credentials.username + ":" + credentials.password);

    // store userName in chrome storage
    chrome.storage.local.set({'cmsUserName': Session.userName}, function(){});
    // localStorage.cmsUserName = Session.userName;

    // redirect
    $location.path('/changes');
  }

  // $rootScope.$broadcast(AUTH_EVENTS.notAuthenticated, 'this is a message');

});

// Main angular controller for app
cmsHacksApp.controller('CRsController',
  function($scope, $rootScope, $timeout, $routeParams, $location, dataFactory, Session, analyticsTracker) {

  analyticsTracker.sendAppView('CRListView');

  $scope.cmsUserId;
  $scope.systemAuthorisers = [];
  $scope.systems = [];
  $scope.crs = [];
  $scope.enableAutoRefresh = true;
  if ($routeParams.status) {
    $scope.viewStatusCode = $routeParams.status;
  } else {
    $scope.viewStatusCode = 'P';
  }

  // Response handlers
  function usersSuccessCallback(resp, status, headers, config) {

    Session.users = resp.users;
    var u = getUserByUserName(Session.users, Session.userName);
    Session.cmsUserId = u.id;
    Session.realName = u.realName;

    $scope.fetchAuthorisingSystems();
  }

  function systemAuthorisersSuccessCallback(resp, status, headers, config) {

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

    $scope.fetchCRs($scope.viewStatusCode);
  }

  function crsSuccessCallback(resp, status, headers, config) {
    // var crs = [];

    var totalEntries = resp.changes.length;

    resp.changes.forEach(function(entry, i) {

      // add cr to array
      $scope.crs.push(loadCR(entry, Session));

      // if this is last cr in response, tell angular
      if (totalEntries - 1 == i) {
        if(!$scope.$$phase) {
          $scope.$apply(function($scope){});
        }
      }
    });
  }

  $scope.clearUser = function() {
    $scope.userId = '';
  }

  $scope.clearAuthorisingSystems = function() {
    $scope.authorisingSystems = [];
  }

  $scope.clearCRs = function() {
    $scope.crs = [];
  }

  $scope.fetchUsers = function() {
    this.clearUser();

    dataFactory.getUsers(Session.basicAuthToken, true).
      success(usersSuccessCallback).
      error(function(err) {
      // TODO: Handle error
    });

  }

  $scope.fetchAuthorisingSystems = function() {

    this.clearAuthorisingSystems();

    dataFactory.getSystemAuthorisers(Session.basicAuthToken, true).
      success(systemAuthorisersSuccessCallback).
      error(function(err) {
      // TODO: Handle error
    });

  }

  $scope.fetchSystems = function() {
    dataFactory.getSystems(Session.basicAuthToken, true).
      success(function(resp, status, headers, config) {
        Session.systems = resp.systems;
        autoRefresh();
      }).
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

  $scope.fetchTeams = function() {
    dataFactory.getTeams(Session.basicAuthToken, true).
      success(function(resp, status, headers, config) {
        Session.teams = resp.teams;
      }).
      error(function(err) {
      // TODO: Handle error
    });
  }

  $scope.fetchCRs = function(statusCode) {

    // analytics
    var timing = analyticsTracker.startTiming('API Performance', 'Fetch CRs');

    var newCRsList = []

    $scope.viewStatusCode = statusCode;

    var systemsLength = Session.authorisingSystemIds.length;
    var systemsCounter = 0;
    Session.authorisingSystemIds.forEach(function(systemId, i){
      dataFactory.getCRs({'systemId':systemId,
                          'status':statusCode,
                          'afterDate':getTodayDate().setDate(today.getDate() - 7)},
                          Session.basicAuthToken, false).
        // success(crsSuccessCallback).
        success(function(resp, status, headers, config) {

          // increment counter
          systemsCounter++;

          var totalEntries = resp.changes.length;

          resp.changes.forEach(function(entry, i) {

            // add cr to array
            if (!(statusCode == 'F' && entry.confirmationStatus != null)) {
              newCRsList.push(loadCR(entry, Session));
            }
          });

          // if we've processed all systems then clean up crs list
          if (systemsCounter == systemsLength) {
            // update scope crs
            if (newCRsList.length == 0) {
              newCRsList.push({listHtml: '<p class="text-center"><strong>Nothing to see here</strong><br/><small>Are your teams working hard enough?</small></p>'});
            }
            $scope.crs = newCRsList;
            if(!$scope.$$phase) {
              $scope.$apply(function($scope){});
            }

            // send performance analytics
            timing.send();
          }


        }, this).
        error(function(err) {
        // TODO: Handle error
      });
    });
  }

  $scope.getActionDateClass = function(actionDateTimeMilli) {
    return getActionDateClass(actionDateTimeMilli);
  }

  // handle cr box click events
  $scope.getCrDetailClick = function(cr) {
    // don't fetch CR if there is no id
    if (cr.id) {
      analyticsTracker.sendEvent('Action', 'Get CR detail');
      $rootScope.$broadcast('VIEW_CR_DETAIL', cr.id);
      $location.path('/changes/' + cr.id);
    }
  }

  // logout
  $scope.doLogout = function() {

    analyticsTracker.sendEvent('Action', 'Logout');

    Session.destroy();
    $scope.enableAutoRefresh = false;
    $location.path('/');
  }

  // fetch details every 10 seconds
  var autoRefresh = function() {
    if ($scope.enableAutoRefresh) $scope.fetchUsers();
    $timeout(autoRefresh, 20000);
  }

  $scope.$on('VIEW_CR_DETAIL', function(event, mass) {
    console.log('VIEW_CR_DETAIL event: disable auto refresh of CRs list')
    $scope.enableAutoRefresh = false;
  });

  // this will start chain of get requests
  $scope.fetchStatuses();
  $scope.fetchTeams();

});

// CR detail view
cmsHacksApp.controller('CRController', function($scope, $rootScope, $routeParams, dataFactory, $location, Session, analyticsTracker) {

  analyticsTracker.sendAppView('CRDetailView');

  $scope.$parent.loading = true;

  function crSuccessCallback(resp, status, headers, config) {
    $scope.cr = loadCR(resp.changes, Session);
    $scope.$parent.loading = false;
  }

  $scope.getCR = function() {
    dataFactory.getCR($routeParams.id, Session.basicAuthToken, false).
        success(crSuccessCallback).
        error(function(err) {
        // TODO: Handle error
        $scope.$parent.loading = false;
    });
  }

  // decide which links to show
  $scope.showAction = function(action) {
    if ($scope.cr) {
      switch (action) {
      case "Authorise":
        if ($scope.cr.statusCode == 'E' || $scope.cr.statusCode == 'P') {
          return true;
        }
        return false;
        break;
      case "Reject":
        if ($scope.cr.statusCode == 'E' || $scope.cr.statusCode == 'P' || $scope.cr.statusCode == 'M') {
          return true;
        }
        return false;
        break;
      case "Confirm":
        if ($scope.cr.statusCode == 'F' && $scope.cr.confirmationStatus == null) {
          return true;
        }
        return false;
        break;
      }
    }
  }

  $scope.getActionDateClass = function(actionDateTimeMilli) {
    return getActionDateClass(actionDateTimeMilli);
  }

  // handle status change events
  $scope.doStatusChange = function(cr, status, success) {
    $scope.$parent.loading = true;
    var data;
    if (success) {
      data = {'action': status, 'success': success};
    } else {
      data = {'action': status};
    }
    dataFactory.updateCRStatus(cr.id, data, Session.basicAuthToken, false).
        success(function() {
          analyticsTracker.sendEvent('Action', 'CR Status Change', status);
          $scope.$parent.loading = false;
          $location.path('/changes');
        }).
        error(function(err) {
        // TODO: Handle error
        $scope.$parent.loading = false;
    });
  }
  $scope.doRescheduleCRToday = function(cr) {
    $scope.$parent.loading = true;
    dataFactory.rescheduleCR(cr.id, new Date().getDate(), Session.basicAuthToken).
      success(function() {
        // reload CR
        $scope.$parent.loading = false;
        $scope.getCR();
      }).
      error(function(err) {
      // TODO: Handle error
      $scope.$parent.loading = false;
    });
  }

  // get CR
  $scope.getCR();

});

// Task detail view
cmsHacksApp.controller('TaskController', function($scope, $rootScope, $routeParams, dataFactory, $location, Session, analyticsTracker) {

  analyticsTracker.sendAppView('TaskDetailView');

  $scope.$parent.loading = true;

  function getTaskSuccessCallback(resp, status, headers, config) {
    $scope.task = loadTask(resp.tasks, Session);
    $scope.$parent.loading = false;
  }

  $scope.getTask = function() {
    dataFactory.getTask($routeParams.id, Session.basicAuthToken, false).
        success(getTaskSuccessCallback).
        error(function(err) {
        // TODO: Handle error
        $scope.$parent.loading = false;
    });
  }

  $scope.getActionDateClass = function(actionDateTimeMilli) {
    return getActionDateClass(actionDateTimeMilli);
  }

  // get task
  $scope.getTask();

});


cmsHacksApp.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'templates/login.html',
      controller: 'LoginController'
    })
    .when('/changes', {
      templateUrl: 'templates/crsList.html',
      controller: 'CRsController'
    })
    .when('/changes/status/:status', {
      templateUrl: 'templates/crsList.html',
      controller: 'CRsController'
    })
    .when('/changes/:id', {
      templateUrl: 'templates/cr.html',
      controller: 'CRController'
    })
    .when('/tasks/:id', {
      templateUrl: 'templates/task.html',
      controller: 'TaskController'
    })
    .otherwise({redirectTo: '/'});
});

cmsHacksApp.config([
    '$compileProvider',
    function( $compileProvider )
    {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|blob:chrome-extension):/);
    }
]);

// will sort of list of objects
cmsHacksApp.filter('orderObjectBy', function(){
 return function(input, attribute) {
    if (!angular.isObject(input)) return input;

    var array = [];
    for(var objectKey in input) {
        array.push(input[objectKey]);
    }

    array.sort(function(a, b){
        a = parseInt(a[attribute]);
        b = parseInt(b[attribute]);
        return a - b;
    });
    return array;
 }
});

cmsHacksApp.filter('breakFilter', function () {
    return function (text) {
        if (text !== undefined) return text.replace(/\n/g, '<br />');
    };
});

// convert urls into links
cmsHacksApp.filter('htmlLinky', function($sanitize, linkyFilter) {
  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  var linkifiedDOM = document.createElement('div');
  var inputDOM = document.createElement('div');

  var linkify = function linkify(startNode) {
    var i, currentNode;

    for (i = 0; i < startNode.childNodes.length; i++) {
      currentNode = startNode.childNodes[i];

      switch (currentNode.nodeType) {
        case ELEMENT_NODE:
          linkify(currentNode);
          break;
        case TEXT_NODE:
          linkifiedDOM.innerHTML = linkyFilter(currentNode.textContent);
          i += linkifiedDOM.childNodes.length - 1
          while(linkifiedDOM.childNodes.length) {
            startNode.insertBefore(linkifiedDOM.childNodes[0], currentNode);
          }
          startNode.removeChild(currentNode);
      }
    }

    return startNode;
  };

  return function(input) {
    inputDOM.innerHTML = input;
    return linkify(inputDOM).innerHTML;
  };
});

cmsHacksApp.directive('formAutofillFix', function ($timeout) {
  return function (scope, element, attrs) {
    element.prop('method', 'post');
    if (attrs.ngSubmit) {
      $timeout(function () {
        element
          .unbind('submit')
          .bind('submit', function (event) {
            event.preventDefault();
            element
              .find('input, textarea, select')
              .trigger('input')
              .trigger('change')
              .trigger('keydown');
            scope.$apply(attrs.ngSubmit);
          });
      });
    }
  };
});
