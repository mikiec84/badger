'use strict';

var app = angular.module('testReport', [
    'angular-loading-bar',
    'ngRoute',
    'testReportServices',
    'testReport.auth.login',
    'testReport.auth.settings',
    'testReport.dashboard',
    'testReport.mainDashboard',
    'testReport.project',
    'testReport.project.settings',
    'testReport.testPlan',
    'testReport.testPlan.execute',
    'testReport.testPlan.add',
    'testReport.testPlan.metrics',
    'testReport.launch',
    'testReport.testResult',
    'testReport.testResult.history',
    'testReport.launchItem.form',
    'testReport.dashboard.top',
    'testReport.dashboard.total',
    'testReport.metric.add',
    'testReport.metric.charts',
    'testReport.metric.total',
    'testReport.metric.zoom',
    'testReport.metric',
    'testReport.regexp'
]);

function secondsToString(seconds, withoutMinutes) {
    var secInDay = 86400;
    var secInHour = 3600;
    var secInMin = 60;

    var days = Math.floor(seconds / secInDay);
    var hours = Math.floor((seconds % secInDay) / secInHour);
    var minutes = Math.floor(((seconds % secInDay) % secInHour) / secInMin);

    var dateFormat = days + 'd ' + hours + 'h';

    return withoutMinutes ? dateFormat : dateFormat + ' ' + minutes + 'm';
}

function parseEnvString(str) {
    var output = [];
    _.each(str.split(';'), function (item) {
        var tmp = item.split('=');
        output[tmp[0]] = tmp[1];
    });
    return output;
}

function isUrl(string) {
    var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return regexp.test(string);
}

app.constant('appConfig', {
    CHART_TYPE_COLUMN: 0,
    CHART_TYPE_AREA: 1,
    RESULT_VIEW_DEFAULT: 0,
    RESULT_VIEW_TREE: 1,
    LAUNCH_STATE_FINISHED: 2,
    LAUNCH_STATE_SUCCESS: 4,
    TESTRESULT_PASSED: 0,
    TESTRESULT_FAILED: 1,
    TESTRESULT_SKIPPED: 2,
    TESTRESULT_BLOCKED: 3,
    TASK_TYPE_REGULAR: 0,
    TASK_TYPE_DEPLOY: 1,
    TASK_TYPE_CONCLUSIVE: 2,
    FRACTION_DIGITS: 2,
    DEFAULT_DAYS: 7,
    CHART_COLORS: parseEnvString(COLORS)
});

app.config(['$routeProvider', '$resourceProvider', '$httpProvider',
           function ($routeProvider, $resourceProvider, $httpProvider) {
    $routeProvider.otherwise({ redirectTo: '/dashboard' });
    $resourceProvider.defaults.stripTrailingSlashes = false;
    // Allow pass cookie session to backend
    $httpProvider.defaults.withCredentials = true;
}]);

app.directive('loadingContainer', function () {
    return {
        restrict: 'A',
        scope: false,
        link: function(scope, element, attrs) {
            var loadingLayer = angular.element('<div class="loading"></div>');
            element.append(loadingLayer);
            element.addClass('loading-container');
            scope.$watch(attrs.loadingContainer, function(value) {
                loadingLayer.toggleClass('ng-hide', !value);
            });
        }
    };
}).directive('tips', function(){
    return {
       restrict: 'E',
       link: function(scope, element, attrs) {
           scope.contentUrl = 'static/app/partials/tips/' + attrs.type + '.html';
           attrs.$observe("type", function(name) {
               scope.contentUrl = 'static/app/partials/tips/' + name + '.html';
           });
       },
       template: '<div ng-include="contentUrl"></div>'
   }
});

app.controller('TipsCtrl', ['$rootScope',
    function($rootScope) {
        $rootScope.open = function (tipsType) {
            var modal = $('#TipsModal');
            modal.modal('hide');
            $rootScope.tipsType = tipsType;
            modal.modal('show');
        };
}]);

app.value('isSafari', bowser.safari);

//for button in active state
$('body').on('click', '.btn-group button', function (e) {
    $(this).addClass('active');
    $(this).siblings().removeClass('active');
});
