﻿/**
* Copyright 2011 Microsoft Corporation
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var assert = require('assert');

var azure = require("../../lib/azure");

var testutil = require('../util/util');
var tabletestutil = require('../util/table-test-utils');

var ServiceClient = require('../../lib/services/serviceclient');
var ExponentialRetryPolicyFilter = require('../../lib/common/exponentialretrypolicyfilter');
var Constants = require('../../lib/util/constants');

var tableService;
var exponentialRetryPolicyFilter;

var tableNames = [];
var tablePrefix = 'expretry';

var testPrefix = 'exponentialretrypolicyfilter-tests';

suite('exponentialretrypolicyfilter-tests', function () {
  setup(function (done) {
    tabletestutil.setUpTest(module.exports, testPrefix, function (err, newTableService) {
      exponentialRetryPolicyFilter = new ExponentialRetryPolicyFilter();
      tableService = newTableService.withFilter(exponentialRetryPolicyFilter);
      done();
    });
  });

  teardown(function (done) {
    tabletestutil.tearDownTest(module.exports, tableService, testPrefix, done);
  });

  test('RetryFailSingle', function (done) {
    var tableName = testutil.generateId(tablePrefix, tableNames, tabletestutil.isMocked);

    var retryCount = 3;
    var retryInterval = 30;

    exponentialRetryPolicyFilter.retryCount = retryCount;
    exponentialRetryPolicyFilter.retryInterval = retryInterval;

    tableService.createTable(tableName, function (err) {
      assert.equal(err, null);

      tableService.createTable(tableName, function (err2) {
        assert.notEqual(err2, null);
        assert.equal(err2.code, Constants.TableErrorCodeStrings.TABLE_ALREADY_EXISTS);
        assert.equal(err2.innerError, null);

        done();
      });
    });
  });

  test('RetryFailMultiple', function (done) {
    var tableName = testutil.generateId(tablePrefix, tableNames, tabletestutil.isMocked);

    var retryCount = 3;

    // 30 seconds as starting time between attempts should be enough to give enough time for the
    // table creation to succeed after a deletion.
    var retryInterval = 30000;

    if (tabletestutil.isMocked && !tabletestutil.isRecording) {
      // if a playback on the mockserver is running, retryinterval can be lower
      retryInterval = 30;

      exponentialRetryPolicyFilter.minRetryInterval = 30;
    }

    exponentialRetryPolicyFilter.retryCount = retryCount;
    exponentialRetryPolicyFilter.retryInterval = retryInterval;

    // replace shouldRetry to skip return codes verification and retry on 409 (deleting)
    exponentialRetryPolicyFilter.shouldRetry = function (statusCode, retryData) {
      var currentCount = (retryData && retryData.retryCount) ? retryData.retryCount : 0;

      return (currentCount < this.retryCount);
    };

    tableService.createTable(tableName, function (err) {
      assert.equal(err, null);

      tableService.deleteTable(tableName, function (err2) {
        assert.equal(err2, null);

        // trying to create a table right after a delete should force retry to kick in
        // table should be created nicely
        tableService.createTable(tableName, function (err3) {
          assert.equal(err3, null);

          done();
        });
      });
    });
  });

  test('GetTablePassOnGetTable', function (done) {
    var tableName = testutil.generateId(tablePrefix, tableNames, tabletestutil.isMocked);

    var retryCount = 3;
    var retryInterval = 30;

    exponentialRetryPolicyFilter.retryCount = retryCount;
    exponentialRetryPolicyFilter.retryInterval = retryInterval;

    tableService.getTable(tableName, function (err, table) {
      assert.equal(err.code, Constants.StorageErrorCodeStrings.RESOURCE_NOT_FOUND);
      assert.equal(table, null);

      done();
    });
  });
});