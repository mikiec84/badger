'use strict';

var app = angular.module('testReport.launch', [
    'ngRoute',
    'ngTable',
    'ngResource',
    'cfp.hotkeys',
    'testReportServices',
    'testReportFilters',
    'ngSanitize'
]);

app.config(['$routeProvider',
    function ($routeProvider) {
        $routeProvider.when('/launch/:launchId', {
            templateUrl: '/static/app/partials/launch/launch.html',
            controller: 'LaunchCtrl'
        });
    }
]);

app.directive('goClick', function ($location) {
    return function (scope, element, attrs) {
        var path;

        attrs.$observe('goClick', function (val) {
            path = val;
        });

        element.bind('click', function () {
            scope.$apply(function () {
                $location.path(path);
            });
        });
    };
});

app.filter('toArray', function() { return function(obj) {
    if (!(obj instanceof Object)) return obj;
    return _.map(obj, function(val, key) {
        return Object.defineProperty(val, '$key', {__proto__: null, value: key});
    });
}});

app.controller('LaunchCtrl', ['$scope', '$rootScope', '$routeParams', '$filter', '$timeout', '$window', 'ngTableParams', 'hotkeys', 'appConfig', 'TestResult', 'Launch', 'Task', 'Comment', 'Bug', 'SortLaunchItems', 'TestPlan',
    function ($scope, $rootScope, $routeParams, $filter, $timeout, $window, ngTableParams, hotkeys, appConfig, TestResult, Launch, Task, Comment, Bug, SortLaunchItems, TestPlan) {
        var initialized = false;

        function getProfileAndDrawTable() {
            $rootScope.getProfile().then(function(profile) {
                $scope.result_view = $rootScope.getProjectSettings($rootScope.getActiveProject(), 'results_view');
                drawTable(profile, $scope.result_view);
            });
        }

        Launch.get({ launchId: $routeParams.launchId }, function (launch) {
            if($rootScope.getActiveProject() === null) {
                TestPlan.get({'testPlanId': launch.test_plan}, function(testplan) {
                    $rootScope.selectProject(testplan.project);
                    getProfileAndDrawTable();
                });
            } else {
                getProfileAndDrawTable();
            }
            $scope.launch = launch;
            if (!$scope.launch.duration) {
                $scope.launch.duration = parseInt((Date.parse(launch.finished) - Date.parse(launch.created)) / (1000 * 60));
            } else {
                $scope.launch.duration = parseInt($scope.launch.duration / 60);
            }
            $scope.getTasksDetails($scope.launch.tasks);
        });

        $scope.jira = JIRA_INTEGRATION;
        $scope.finished = true;
        $scope.modalSuite = '';
        $scope.modalName = '';
        $scope.modalBody = '';
        $scope.modalId = 0;
        $scope.state = appConfig.TESTRESULT_FAILED;
        $scope.data = [];
        $scope.index = null;
        $scope.tasks = [];
        $scope.states = [
            appConfig.TESTRESULT_PASSED,
            appConfig.TESTRESULT_FAILED,
            appConfig.TESTRESULT_SKIPPED,
            appConfig.TESTRESULT_BLOCKED];
        $scope.form_comment = '';
        $scope.comment_disabled = false;
        $scope.bugs = [];
        $scope.timers = [];
        $scope.currentTask = null;
        $scope.terminateButtonActive = true;
        $scope.terminateMessage = null;

        $scope.$watch('regExp', function (text) {
            var pattern = '/(?:)/';
            if (text) {
                //escape special symbols to avoid problem with regexp
                pattern = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            }
            var regexp = new RegExp(pattern, 'm');
            _.each(_.reduceRight($scope.data, function(a, b) { return a.concat(b); }), function (item) {
                item.hidden = false;
                if (!regexp.test(item.failure_reason)) {
                    item.hidden = true;
                }
            });
        });

        $scope.addBug = function () {
            var bug = new Bug();
            bug.externalId = $scope.bugId;
            bug.regexp = $scope.regExp;
            Bug.save(bug, function (result) {
                $scope.bugId = null;
                $scope.regExp = null;
                $scope.apiErrors = null;
                $scope.updateBugBinding();
                $scope.tableParams.reload();
            }, function (result) {
                $scope.apiErrors = result.data.message;
            });
        };

        $scope.updateBugBinding = function () {
            Bug.get({}, function(result) {
                $scope.bugs = result.results;
                _.each($scope.data, function (item) {
                    item.bugs = [];
                });
                _.each($scope.bugs, function (bug) {
                    bug.regexp = bug.regexp.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                    var regexp = new RegExp(bug.regexp, 'm');
                    _.each(_.reduceRight($scope.data, function(a, b) { return a.concat(b); }), function (item) {
                        if (!_.find(item.bugs, function (b) {
                                return b.externalId === bug.externalId && b.regexp === bug.regexp;
                            })) {
                            if (regexp.test(item.failure_reason)) {
                                if (!item.bugs) {
                                    item.bugs = [];
                                }
                                item.bugs.push(bug);
                            }
                        }
                    });
                });
            });
        };

        $scope.$watch('data', function () {
            $scope.updateBugBinding();
        });

        function updateTask(taskId) {
            $scope.timers.push($timeout(
                function () {
                    Task.get({taskId: taskId}, function(data) {
                        _.each($scope.tasks, function(value) {
                            if (value.key == data.id) {
                                value['result'] = data;
                                if (data.status === 'STARTED' || data.status === 'PENDING') {
                                    updateTask(taskId);
                                } else {
			 	                    Launch.get({ launchId: $routeParams.launchId }, function (launch) {
                                        $scope.launch = launch;
                                    });
				                }
                            }
                        });
                    });
                }, 5000
            ));
        }

        $scope.getTasksDetails = function(tasks) {
            _.each(tasks, function(value, key) {
                $scope.tasks.push({key: key, item: value});
                Task.get({taskId: key}, function(data) {
                    _.each($scope.tasks, function(value) {
                        if (value.key == data.id) {
                            value['result'] = data;
                            if (data.status === 'STARTED' || data.status === 'PENDING') {
                                updateTask(key);
                            }
                        }
                    });
                });
            });
            $scope.tasks.sort(function (a, b) {
                return b.item.type - a.item.type;
            });

            //sorting
            _.each($scope.tasks, function(task) {
                task.name = task.item.name;
                task.type = task.item.type;
            });
            $scope.tasks = SortLaunchItems.byType($scope.tasks);
        };

        $scope.$watch('state', function () {
            // Workaround Not call reload after first change of state, to prevent getting GET request twice on page load
            if (initialized) {
                $scope.tableParams.reload();
            } else {
                initialized = true;
            }
        });

        $scope.openResults = function (item) {
            $scope.index = item;
            setFirstAndLastElementsForFailedNavigation(item);
            setFirstAndLastElementsForFullNavigation(item);

            var selection = $window.getSelection();
            if (selection.type === 'Range') {
                return false;
            }

            var modal = $('#TestDetailsModal');

            modal.modal('hide');

            $scope.modalSuite = item.suite;
            $scope.modalName = item.name;
            $scope.modalState = item.state;
            $scope.modalBody = item.failure_reason;
            $scope.modalId = item.id;
            modal.modal('show');
        };

        $scope.$on(
            "$destroy",
            function (event) {
                _.each($scope.timers, function (timer) {
                    $timeout.cancel(timer);
                })
            }
        );

        $scope.openTask = function (task) {
            if (task.result.status === 'PENDING') {
                return;
            }
            $scope.currentTask = task;
        };

        $scope.closeTask = function () {
            $scope.currentTask = null;
        };

        $scope.openAddCommentModal = function() {
            var modal = $('#AddCommentModal');
            modal.modal('show');
        };

        $scope.submitComment = function () {
            $scope.comment_disabled = true;
            if ($scope.form_comment !== '') {
                var comm = new Comment();
                comm.comment = $scope.form_comment;
                comm.content_type = 'launch';
                comm.object_pk = $routeParams.launchId;
                comm.$save(function(result) {
                    $scope.form_comment = '';
                    $scope.comment = '';
                    $('#AddCommentModal').modal('hide');
                    $scope.comments.reload();
                    $scope.comment_disabled = false;
                    $scope.formErrors = null;
                }, function (result) {
                    $scope.formErrors = result;
                })
            }
        };

        function findNextItem(item, state, direction, currentFound) {
            if (!currentFound) {
                currentFound = false;
            }
            var suites = $scope.tableParams.data;
            if (direction === 'forward') {
                for (var i = 0; i < suites.length; i++) {
                    for (var j = 0; j < suites[i].length; j++) {
                        if (state instanceof Array) {
                            if (currentFound && state.indexOf(suites[i][j].state) !== -1) {
                                return suites[i][j];
                            }
                        } else {
                            if (currentFound && suites[i][j].state == state) {
                                return suites[i][j];
                            }
                        }
                        if (suites[i][j].id === item.id)
                            currentFound = true;
                        }
                }
            } else {
                for (var i = suites.length - 1; i >= 0; i--) {
                    for (var j = suites[i].length - 1; j >= 0; j--) {
                        if (state instanceof Array) {
                            if (currentFound && state.indexOf(suites[i][j].state) !== -1) {
                                return suites[i][j];
                            }
                        } else {
                            if (currentFound && suites[i][j].state == state) {
                                return suites[i][j];
                            }
                        }
                        if (suites[i][j].id === item.id) {
                            currentFound = true;
                        }
                    }
                }
            }
            // Current item is last, find from start
            if (currentFound) {
                return findNextItem(item, state, direction, true);
            }
        }

        $scope.nextItem = function(states) {
            if ($scope.disableMainNext) {
                return;
            }

            if (_.isArray(states)) {
                $scope.openResults(findNextItem($scope.index, states, 'forward'));
            } else {
                $scope.openResults(findNextItem($scope.index, $scope.states, 'forward'));
            }
        };

        $scope.prevItem = function(states) {
            if ($scope.disableMainPrev) {
                return;
            }

            if (_.isArray(states)) {
                $scope.openResults(findNextItem($scope.index, states, 'backward'));
            } else {
                $scope.openResults(findNextItem($scope.index, $scope.states, 'backward'));
            }
        };

        hotkeys.add({ combo: 'j', callback: $scope.nextItem });
        hotkeys.add({ combo: 'right', callback: $scope.nextItem });
        hotkeys.add({ combo: 'k', callback: $scope.prevItem });
        hotkeys.add({ combo: 'left', callback: $scope.prevItem });

        var create_table_attempt = 0;

        function drawTable(profile, type) {
            if (type === appConfig.RESULT_VIEW_DEFAULT) {
                $scope.tableParams = defaultTable(profile);
            }
            if (type === appConfig.RESULT_VIEW_TREE) {
                $scope.tableParams = treeTable();
            }
        }

        function defaultTable (profile) {
            return new ngTableParams({
                page: 1,
                count: 25,
                sorting: {
                    duration: 'desc'
                }
            }, {
                total: 0,
                getData: function ($defer, params) {
                    create_table_attempt += 1;
                    if (profile && create_table_attempt === 1) {
                        $scope.tableParams.$params.count =
                            profile.settings ? profile.settings.testresults_on_page : 25;
                    }
                    var ordering;

                    for (var prop in params.sorting()) {
                        ordering = prop;
                        if (params.sorting()[prop] !== 'asc') {
                            ordering = '-' + prop;
                        }
                        break;
                    }
                    TestResult.get({
                        launchId: $routeParams.launchId,
                        page: params.page(),
                        pageSize: params.count(),
                        ordering: ordering,
                        state: $scope.state,
                        search: params.$params.filter.failure_reason
                    }, function (result) {
                        params.total(result.count);
                        $scope.data = _.groupBy(result.results, function (item) {
                            return item.launch_item_id;
                        });


                        $scope.data = $filter('toArray')($scope.data);
                        var dataLength = 0;
                        _.each($scope.data, function(group) {
                            dataLength += group.length;
                        });

                        $defer.resolve($scope.data);
                        $scope.tableParams.settings({counts: dataLength >= 10 ? [10, 25, 50, 100] : []});
                    });
                }
            });
        }

        function treeTable() {
            return new ngTableParams({
                count: 99999
            }, {
                total: 0,
                getData: function ($defer, params) {
                    TestResult.get({
                        launchId: $routeParams.launchId,
                        page: 1,
                        pageSize: 9999,
                        search: params.$params.filter.failure_reason
                    }, function (result) {
                        params.total(result.count);
                        $scope.data = _.groupBy(result.results, function (item) {
                            return item.suite;
                        });

                        $scope.data = _.mapObject($scope.data, function (cases, key){
                            cases = setOrder(cases);
                            return $filter('orderBy')(cases, ['order', '-duration']);
                        });

                        _.each($scope.data, function(group, group_name) {
                            $scope.data[group_name].passed = _.filter(group, function(result) {
                                return result.state === 0;
                            }).length;
                            $scope.data[group_name].skipped = _.filter(group, function(result) {
                                return result.state === 2;
                            }).length;
                            $scope.data[group_name].failed = _.filter(group, function(result) {
                                return result.state === 1;
                            }).length;
                            $scope.data[group_name].blocked = _.filter(group, function(result) {
                                return result.state === 3;
                            }).length;
                        });

                        $scope.data = $filter('toArray')($scope.data)
                        $scope.data = $filter('orderBy')($scope.data, ['-failed+blocked', '$key']);

                        $defer.resolve($scope.data);
                        $scope.tableParams.settings({counts: []});
                    });
                }
            });
        }

        function setOrder(group) {
            _.each(group, function(item) {
                switch(item.state) {
                    case 0:
                        item.order = 2;
                        break;
                    case 1:
                        item.order = 1;
                        break;
                    case 2:
                        item.order = 3;
                        break;
                    case 3:
                        item.order = 0;
                        break;
                    default:
                        item.order = 4;
                }
            });
            return group;
        }

        $scope.comments = new ngTableParams({
            page: 1,
            count: 3,
            sorting: {
                submit_date: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                var ordering;
                for (var prop in params.sorting()) {
                    ordering = prop;
                    if (params.sorting()[prop] !== 'asc') {
                        ordering = '-' + prop;
                    }
                    break;
                }
                Comment.get({
                    content_type__name: 'launch',
                    object_pk: $routeParams.launchId,
                    page: params.page(),
                    pageSize: params.count(),
                    ordering: ordering
                }, function (result) {
                    params.total(result.count);
                    $defer.resolve(result.results);
                });
            }
        });

        $scope.getLaunchItemById = function (launchItemId) {
            launchItemId = parseInt(launchItemId);
            for (var i = 0; i < $scope.tasks.length; i++) {
                if ($scope.tasks[i].item.id === launchItemId) {
                    return $scope.tasks[i].item;
                }
            }
            return {'name': 'No launch item binding'};
        };

        $scope.terminateLaunchTasks = function (launchId) {
            $scope.terminateButtonActive = false;
            Launch.terminate_tasks({ launchId: launchId }, function (response) {
                $scope.tasks = [];
                Launch.get({ launchId: $routeParams.launchId }, function (launch) {
                    $scope.launch = launch;
                    $scope.launch.duration = parseInt((Date.parse(launch.finished) - Date.parse(launch.created)) / (1000 * 60));
                    $scope.getTasksDetails($scope.launch.tasks);
                });
                $scope.apiErrors = response.message;
            }, function (response) {
                $scope.apiErrors = response.data.message || response.details;
                $scope.terminateButtonActive = true;
            });
        };

        $(".modal-wide").on("show.bs.modal", function() {
          var height = $(window).height() - 250;
          $(this).find(".modal-body").css("max-height", height);
        });

        //for navigation
        function getBlockedAndFailedTestResults() {

            function isBlockedOrFailed(result) {
                return result.state === 1 || result.state === 3;
            }

            function isNotEmptyArray(array) {
                return array.length > 0;
            }

            var failedAndBlockedResults = _.map($scope.tableParams.data, function(group) {
                return _.filter(group, isBlockedOrFailed);
            });

            return _.filter(failedAndBlockedResults, isNotEmptyArray);
        }

        function getFirstAndLastIds(results) {
            var i = results.length - 1;
            var j = results[i].length - 1;
            return [results[0][0].id, results[i][j].id];
        }

        function setFirstAndLastElementsForFailedNavigation(item) {
            var results = getBlockedAndFailedTestResults();
            if (results.length !== 0) {
                var ids = getFirstAndLastIds(results);

                $scope.disableFailedPrev = (item.id === ids[0]) ? true : false;
                $scope.disableFailedNext = (item.id === ids[1]) ? true : false;
            }
        }

        function setFirstAndLastElementsForFullNavigation(item) {
            var results = $scope.tableParams.data;
            var ids = getFirstAndLastIds(results);

            $scope.disableMainPrev = (item.id === ids[0]) ? true : false;
            $scope.disableMainNext = (item.id === ids[1]) ? true : false;
        }
    }
]);
