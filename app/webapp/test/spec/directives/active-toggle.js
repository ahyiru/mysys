'use strict';

describe('Directive: activeToggle', function () {

  // load the directive's module
  beforeEach(module('minovateApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<active-toggle></active-toggle>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the activeToggle directive');
  }));
});
