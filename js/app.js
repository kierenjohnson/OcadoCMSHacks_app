/* jshint undef: true, unused: true */
/* global angular, FastClick, DataFactory, analytics, chrome, logEvent, initialiseSession,
		loadTask, loadCR, getActionDateClass, getTodayDate, today */

// define the application
angular.module('cmsHacksApp', ['ngRoute','ngSanitize','ui.bootstrap'])
  .run(function() {
    // attach FastClick to document body
    // this removes 300 ms click wait for mobile browsers
    FastClick.attach(document.body);
  })

// define data factory
.factory('dataFactory', ['$http', function($http) {
  var dataFactory = new DataFactory($http);
  return dataFactory;
}])

// google anayltics tracker factory
.factory('analyticsTracker', function() {

  // initialise google analytics service object
  var service = analytics.getService('cms_hacks_app');

  // Get a Tracker using your Google Analytics app Tracking ID.
  var tracker = service.getTracker('UA-27869830-5');
  return tracker;
})


// singleton service for storing session variables
.service('Session', function () {
  this.create = function (userName, realName, cmsUserId,
                          authorisingSystemIds, basicAuthToken,
                          users, systems, statuses, teams, systemManagers, teamUsers, userTeams,
                          signOffSystemIds, currentView, sessionEventHistory) {
    this.userName = userName;
    this.realName = realName;
    this.cmsUserId = cmsUserId;
    this.authorisingSystemIds = authorisingSystemIds;  // ids of systems this user authorises
    this.basicAuthToken = basicAuthToken;
    this.users = users; // all users of the system (needed to lookup raisers etc)
    this.systems = systems; // all cms systems
    this.statuses = statuses; // all cms status codes
    this.teams = teams; // all cms teams
    this.systemManagers = systemManagers;
    this.teamUsers = teamUsers; // All teams/users
    this.userTeams = userTeams; // List of teams this user is in
    this.signOffSystemIds = signOffSystemIds; // ids of systems this user can sign off
    this.currentView = currentView; // signOff or pendAuth
    this.sessionEventHistory = sessionEventHistory;
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
    this.systemManagers = null;
    this.teamUsers = null;
    this.userTeams = null;
    this.signOffSystemIds = null;
    this.currentView = null;
    this.sessionEventHistory = null;
  };
  return this;
})

// define constants for authentication issues
.constant('AUTH_EVENTS', {
  loginSuccess: 'auth-login-success',
  loginFailed: 'auth-login-failed',
  logoutSuccess: 'auth-logout-success',
  sessionTimeout: 'auth-session-timeout',
  notAuthenticated: 'auth-not-authenticated',
  notAuthorized: 'auth-not-authorized'
})

// create an authentication interceptor
.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
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
})

.config(function ($httpProvider) {
  $httpProvider.interceptors.push([
    '$injector',
    function ($injector) {
      return $injector.get('AuthInterceptor');
    }
  ]);
})

.controller('MainController', function($scope, $rootScope, $location, $timeout, $anchorScroll, Session, analyticsTracker, AUTH_EVENTS) {

  // get application version id
  $scope.manifest = chrome.runtime.getManifest();
  console.log($scope.manifest.version);

  // initialise loading spinner display to false
  $scope.loading = false;
  $scope.signedInAs = '';
  $scope.isDev = false;
  // Session.sessionEventHistory = [];
  chrome.storage.local.get('invertNavBar', function(obj) {
    if(obj.invertNavBar) {
      $scope.invertNavBar = obj.invertNavBar;
    } else {
      $scope.invertNavBar = false;
    }
  });

  $scope.alerts = [];

  $scope.addAlert = function(type, mssg) {
    // don't push the alert if it exists already
    for (var i = 0; i < $scope.alerts.length; i++) {
      if ($scope.alerts[i].msg == mssg) {
        return;
      }
    }
    $scope.alerts.push({type: type, msg: mssg});
    window.scrollTo(0,0);
  };

  $scope.closeAlert = function(index) {
    $scope.alerts.splice(index, 1);
  };

  $scope.clearAlerts = function() {
    $scope.alerts = [];
  };

  $scope.query = {
    crId: ''
  };

  $scope.isLoggedIn = function() {
    return ($location.path() != '/');
  };

  $scope.search = function(query) {
    if (query.crId) {
      analyticsTracker.sendEvent('Action', 'Search');
      // redirect
      $rootScope.$broadcast('VIEW_CR_DETAIL', query.crId);
      $location.path('/changes/' + query.crId);
    }
  };

  $scope.$on(AUTH_EVENTS.notAuthenticated, function(event, mass) {
    $scope.loading = false;
    console.log(mass);
    logEvent(Session.sessionEventHistory, "Authentication failure");
    $scope.addAlert('danger', 'Authentication failure');
  });
  $scope.$on(AUTH_EVENTS.notAuthorized, function(event, mass) {
    $scope.loading = false;
    console.log(mass);
    logEvent(Session.sessionEventHistory, "Not authorised to perform that action");
    $scope.addAlert('danger', 'Not authorised to perform action');
  });

  $scope.toggleNavBar = function() {
    $scope.invertNavBar = !$scope.invertNavBar;
    chrome.storage.local.set({'invertNavBar': $scope.invertNavBar}, function(){});
  };

  $scope.getNavBarClass = function() {
    return ($scope.invertNavBar)?'navbar-inverse':'';
  };

  // is this running locally (development) or the chrome store version
  // TODO: this doesn't work on ios/android
  try {
    if (chrome.i18n.getMessage('@@extension_id') != 'deffpdnchjjjaoimbnfjkoofjofdgkni') {
      $scope.isDev = true;
    }
  } catch(err) {
    console.log('chrome.i18n api not supported');
  }

  $scope.doViewChange = function(statusCode) {
    $rootScope.$broadcast('VIEW_CRS', 'statusCode: ' + statusCode);
    chrome.storage.local.set({'defaultViewStatusCode': statusCode}, function(){});
    Session.currentView = statusCode;
    $location.path('/changes/status/' + statusCode);
  };

  $scope.getViewActiveClass = function(statusCode) {
    return (statusCode == Session.currentView) ? 'active':'';
  };

  // initialise Session.currentView
  chrome.storage.local.get('defaultViewStatusCode', function(obj){
    Session.currentView = (obj.defaultViewStatusCode) ? obj.defaultViewStatusCode : 'P';
  });

})

// Controller for the login page
// Capture login event, store session variables and
// change page to the crsList
.controller('LoginController',function($scope, $rootScope, $location, Session, dataFactory, analyticsTracker) {

  // Record an "appView" each time the user launches your app or goes to a new
  // screen within the app.
  analyticsTracker.sendAppView('LoginView');

  Session.sessionEventHistory = [];

  // clear any alerts
  $scope.$parent.clearAlerts();

  $scope.credentials = {
    username: '',
    password: ''
  };

  $scope.applicationVersion = $scope.$parent.manifest.version;

  chrome.storage.local.get('cmsUserName', function(obj) {
    $scope.credentials.username = obj.cmsUserName;
    if(!$scope.$$phase) {
      $scope.$apply(function(){
        $('#password').focus();
      });
    }
  });

  // $scope.credentials.username = localStorage.cmsUserName;
  if(!$scope.$$phase) {
    $scope.$apply(function(){
      $('#password').focus();
    });
  }


  $scope.login = function(credentials) {

    $scope.$parent.loading = true;
    analyticsTracker.sendEvent('Action', 'Login');

    Session.userName = credentials.username;
    Session.basicAuthToken = btoa(credentials.username + ":" + credentials.password);

    // store userName in chrome storage
    chrome.storage.local.set({'cmsUserName': Session.userName}, function(){});
    // localStorage.cmsUserName = Session.userName;

    // Get user, system, area and team details
    initialiseSession($scope, dataFactory, Session, function() {
      $scope.$parent.loading = false;
      logEvent(Session.sessionEventHistory, "Login");
      $location.path('/changes');
    });
  };

  // if there was a problem with the username
  $scope.$on('ERR_USERNAME_NOT_FOUND', function(event, mass) {
    console.log('ERR_USERNAME_NOT_FOUND: ' + mass);
    $scope.$parent.loading = false;
    $scope.addAlert('danger', 'Sorry, that username was not found in CMS');
  });

})

// Main angular controller for app
.controller('CRsController',
  function($scope, $rootScope, $timeout, $routeParams, $location, dataFactory, Session, analyticsTracker, AUTH_EVENTS) {

  analyticsTracker.sendAppView('CRListView');

  // clear any alerts
  $scope.$parent.clearAlerts();

  $scope.enableAutoRefresh = true;
  $scope.$parent.loading = true;

  $scope.fetchCRs = function(statusCode) {

    // analytics
    var timing = analyticsTracker.startTiming('API Performance', 'Fetch CRs');

    var newCRsList = [];

    $scope.viewStatusCode = statusCode;

    var systemsLength = Session.authorisingSystemIds.length;
    var systemsCounter = 0;
    Session.authorisingSystemIds.forEach(function(systemId){
      dataFactory.getCRs({'systemId':systemId,
                          'status':statusCode,
                          'afterDate':getTodayDate().setDate(today.getDate() - 7)},
                          Session.basicAuthToken, false).
        success(function(resp) {

          // increment counter
          systemsCounter++;

          resp.changes.forEach(function(entry) {

            // add cr to array
            if (!(statusCode == 'F' && entry.confirmationStatus !== null)) {
              newCRsList.push(loadCR(entry, Session));
            }
          });

          // if we've processed all systems then clean up crs list
          if (systemsCounter == systemsLength) {
            // update scope crs
            if (newCRsList.length === 0) {
              newCRsList.push({listHtml: '<p class="text-center"><strong>Nothing to see here</strong><br/><small>Move along.</small></p>'});
            }
            $scope.crs = newCRsList;
            if(!$scope.$$phase) {
              $scope.$apply(function(){});
            }

            $scope.$parent.loading = false;
            // send performance analytics
            timing.send();
          }


        }, this).
        error(function() {
        // TODO: Handle error
        $scope.$parent.loading = false;
      });
    });
  };

  $scope.getActionDateClass = function(actionDateTimeMilli) {
    return getActionDateClass(actionDateTimeMilli);
  };

  // handle cr box click events
  $scope.getCrDetailClick = function(cr) {
    // don't fetch CR if there is no id
    if (cr.id) {
      analyticsTracker.sendEvent('Action', 'Get CR detail');
      $rootScope.$broadcast('VIEW_CR_DETAIL', cr.id);
      $location.path('/changes/' + cr.id);
    }
  };

  // logout
  $scope.doLogout = function() {

    analyticsTracker.sendEvent('Action', 'Logout');

    Session.destroy();
    $scope.enableAutoRefresh = false;
    $location.path('/');
  };

  // fetch details every 10 seconds
  var autoRefresh = function() {
    if ($scope.enableAutoRefresh) $scope.fetchCRs($scope.viewStatusCode);
    $timeout(autoRefresh, 20000);
  };

  $scope.$on('VIEW_CR_DETAIL', function() {
    console.log('VIEW_CR_DETAIL event: disable auto refresh of CRs list');
    $scope.enableAutoRefresh = false;
  });

  $scope.$on('VIEW_CRS', function() {
    console.log('VIEW_CRS event: disable auto refresh of this CRs list (another is being opened)');
    $scope.enableAutoRefresh = false;
  });

  $scope.$on(AUTH_EVENTS.notAuthenticated, function() {
    // if there is an authentication failure disable auto refresh
    $scope.enableAutoRefresh = false;
  });

  if ($routeParams.status) {
    $scope.viewStatusCode = $routeParams.status;
    autoRefresh();
  } else {
    chrome.storage.local.get('defaultViewStatusCode', function(obj) {
      if(obj.defaultViewStatusCode) {
        $scope.viewStatusCode = obj.defaultViewStatusCode;
      } else {
        $scope.viewStatusCode = 'P';
      }
      autoRefresh();
    });
  }
})

// CR detail view
.controller('CRController', function($scope, $rootScope, $routeParams, dataFactory, $location, Session, analyticsTracker) {

  analyticsTracker.sendAppView('CRDetailView');

  // clear any alerts
  $scope.$parent.clearAlerts();


  function crSuccessCallback(resp) {
    if (resp.changes) {
      $scope.cr = loadCR(resp.changes, Session);
    } else {
      console.log('VIEW_CR_DETAIL event: could not load CR ' + $routeParams.id);
      $scope.addAlert('danger', 'Sorry, CR# ' + $routeParams.id + ' was not found in CMS');
    }
    $scope.$parent.loading = false;
  }

  $scope.initialise = function() {
    $scope.$parent.loading = true;
    $scope.showComments = false;
    $scope.getCR();
  };

  $scope.getCR = function() {
    dataFactory.getCR($routeParams.id, Session.basicAuthToken, false).
        success(crSuccessCallback).
        error(function() {
        // TODO: Handle error
        $scope.$parent.loading = false;
    });
  };

  $scope.showPreReqTasks = function() {
    if ($scope.cr) {
      if ($scope.cr.preRequisiteTasks && $scope.cr.preRequisiteTasks.length > 0) {
        return true;
      }
    }
    return false;
  };

  // decide which links to show
  $scope.showAction = function(action) {
    if ($scope.cr) {
      switch (action) {
      case "Authorise":
        if ($scope.cr.statusCode == 'E' || $scope.cr.statusCode == 'P') {
          return true;
        }
        return false;
      case "SignOff":
        if ($scope.cr.statusCode == 'M') {
          return true;
        }
        return false;
      case "Reject":
        if ($scope.cr.statusCode == 'E' || $scope.cr.statusCode == 'P' || $scope.cr.statusCode == 'M') {
          return true;
        }
        return false;
      case "Confirm":
        if ($scope.cr.statusCode == 'F' && $scope.cr.confirmationStatus === null) {
          return true;
        }
        return false;
      case "Refresh":
        return true;
      }
    }
  };

  $scope.getActionDateClass = function(actionDateTimeMilli) {
    return getActionDateClass(actionDateTimeMilli);
  };

  // handle status change events
  $scope.doStatusChange = function(cr, status, config) {
    $scope.$parent.loading = true;
    var data;
    if (typeof config.success != "undefined") {
      data = {'action': status, 'success': config.success};
    } else if (typeof config.testingStatus != "undefined") {
      data = {'action': status, 'testingStatus': config.testingStatus};
    } else {
      data = {'action': status};
    }
    dataFactory.updateCRStatus(cr.id, data, Session.basicAuthToken, false).
        success(function() {
          analyticsTracker.sendEvent('Action', 'CR Status Change', status);
          logEvent(Session.sessionEventHistory, "CR #" + cr.id + " status changed to " + status);
          $scope.$parent.loading = false;
          $location.path('/changes');
        }).
        error(function() {
        // TODO: Handle error
        console.log('Error performing status update');
        $scope.$parent.loading = false;
    });
  };

  $scope.doRescheduleCRToday = function(cr) {
    $scope.$parent.loading = true;
    dataFactory.rescheduleCR(cr.id, new Date().getDate(), Session.basicAuthToken).
      success(function() {
        // reload CR
        $scope.$parent.loading = false;
        $scope.getCR();
      }).
      error(function() {
      // TODO: Handle error
      $scope.$parent.loading = false;
    });
  };

  $scope.toggleComments = function() {
    $scope.showComments = !$scope.showComments;
  };

  // get CR
  $scope.initialise();

})

// Task detail view
.controller('TaskController', function($scope, $rootScope, $routeParams, dataFactory, $location, Session, analyticsTracker) {

  analyticsTracker.sendAppView('TaskDetailView');

  // clear any alerts
  $scope.$parent.clearAlerts();

  $scope.$parent.loading = true;

  function getTaskSuccessCallback(resp) {
    $scope.task = loadTask(resp.tasks, Session);
    $scope.$parent.loading = false;
  }

  $scope.getTask = function() {
    dataFactory.getTask($routeParams.id, Session.basicAuthToken, false).
        success(getTaskSuccessCallback).
        error(function() {
        // TODO: Handle error
        $scope.$parent.loading = false;
    });
  };

  $scope.getActionDateClass = function(actionDateTimeMilli) {
    return getActionDateClass(actionDateTimeMilli);
  };

  // get task
  $scope.getTask();

})

// PreReq Task detail view
.controller('PreReqTaskController', function($scope, $rootScope, $routeParams, dataFactory, $location, Session, analyticsTracker) {

  analyticsTracker.sendAppView('PreReqTaskDetailView');

  // clear any alerts
  $scope.$parent.clearAlerts();

  $scope.$parent.loading = true;

  function getPreReqTaskSuccessCallback(resp) {
    $scope.task = loadTask(resp.prerequisiteTask, Session);
    $scope.$parent.loading = false;
  }

  $scope.getPreReqTask = function() {
    dataFactory.getPreReqTask($routeParams.id, Session.basicAuthToken, false).
        success(getPreReqTaskSuccessCallback).
        error(function() {
        // TODO: Handle error
        $scope.$parent.loading = false;
    });
  };

  $scope.getActionDateClass = function(actionDateTimeMilli) {
    return getActionDateClass(actionDateTimeMilli);
  };

  // get task
  $scope.getPreReqTask();

})


// Task detail view
.controller('EventsController', function($scope, Session, analyticsTracker) {

  analyticsTracker.sendAppView('EventsView');

  // clear any alerts
  $scope.$parent.clearAlerts();

  $scope.events = Session.sessionEventHistory;

})

.config(function($routeProvider) {
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
    .when('/prereqTasks/:id', {
      templateUrl: 'templates/task.html',
      controller: 'PreReqTaskController'
    })
    .when('/events', {
      templateUrl: 'templates/eventsList.html',
      controller: 'EventsController'
    })
    .otherwise({redirectTo: '/'});
})

.config([
    '$compileProvider',
    function( $compileProvider )
    {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|blob:chrome-extension):/);
    }
])

// will sort of list of objects
.filter('orderObjectBy', function(){
 return function(input, attribute) {
    if (!angular.isObject(input)) return input;

    var array = [];
    for(var objectKey in input) {
      if (input.hasOwnProperty(objectKey)) {
        array.push(input[objectKey]);
      }
    }

    array.sort(function(a, b){
        a = parseInt(a[attribute]);
        b = parseInt(b[attribute]);
        return a - b;
    });
    return array;
 };
})

// will remove line breaks
.filter('breakFilter', function () {
    return function (text) {
        if (text !== undefined) return text.replace(/\n/g, '<br />');
    };
})

// convert urls into links
.filter('htmlLinky', function($sanitize, linkyFilter) {
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
          i += linkifiedDOM.childNodes.length - 1;
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
})

.directive('formAutofillFix', function ($timeout) {
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
