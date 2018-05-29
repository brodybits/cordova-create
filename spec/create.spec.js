/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

const fs = require('fs-extra');

const path = require('path');

const requireFresh = require('import-fresh');

const create = require('..');
const events = require('cordova-common').events;
const CordovaError = require('cordova-common').CordovaError;
const ConfigParser = require('cordova-common').ConfigParser;
const {tmpDir, createWith, createWithMockFetch, expectRejection} = require('./helpers');

const appName = 'TestBase';
const appId = 'org.testing';
const project = path.join(tmpDir, appName);

// Setup and teardown test dirs
beforeEach(function () {
    fs.removeSync(project);
    fs.ensureDirSync(tmpDir);
});
afterEach(function () {
    process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
    fs.removeSync(tmpDir);
});

describe('cordova create checks for valid-identifier', function () {
    const error = new CordovaError('is not a valid identifier');

    it('should reject reserved words from start of id', function () {
        return expectRejection(create(project, 'int.bob', appName, {}, events), error);
    });

    it('should reject reserved words from end of id', function () {
        return expectRejection(create(project, 'bob.class', appName, {}, events), error);
    });
});

describe('create end-to-end', function () {

    function checkProject () {
        // Check if top level dirs exist.
        const dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function (d) {
            expect(path.join(project, d)).toExist();
        });

        expect(path.join(project, 'hooks', 'README.md')).toExist();

        // Check if www files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();

        // Check that config.xml was updated.
        const configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);

        // TODO (kamrik): check somehow that we got the right config.xml from the fixture and not some place else.
        // expect(configXml.name()).toEqual('TestBase');
    }

    function checkConfigXml () {
        // Check if top level dirs exist.
        const dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function (d) {
            expect(path.join(project, d)).toExist();
        });
        expect(path.join(project, 'hooks', 'README.md')).toExist();

        // index.js and template subdir folder should not exist (inner files should be copied to the project folder)
        expect(path.join(project, 'index.js')).not.toExist();
        expect(path.join(project, 'template')).not.toExist();

        // Check if www files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();
        const configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);
        expect(configXml.version()).toEqual('1.0.0');

        // Check that config.xml does not exist inside of www
        expect(path.join(project, 'www', 'config.xml')).not.toExist();

        // Check that we got no package.json
        expect(path.join(project, 'package.json')).not.toExist();

        // Check that we got the right config.xml from the template and not stock
        expect(configXml.description()).toEqual('this is the correct config.xml');
    }

    function checkSubDir () {
        // Check if top level dirs exist.
        const dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function (d) {
            expect(path.join(project, d)).toExist();
        });
        expect(path.join(project, 'hooks', 'README.md')).toExist();

        // index.js and template subdir folder should not exist (inner files should be copied to the project folder)
        expect(path.join(project, 'index.js')).not.toExist();
        expect(path.join(project, 'template')).not.toExist();

        // Check if config files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();

        // Check that config.xml was updated.
        const configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);
        expect(configXml.version()).toEqual('1.0.0');
        // Check that we got package.json (the correct one)
        const pkjson = requireFresh(path.join(project, 'package.json'));
        // Pkjson.displayName should equal config's name.
        expect(pkjson.displayName).toEqual(appName);
        expect(pkjson.valid).toEqual('true');

        // Check that we got the right config.xml
        expect(configXml.description()).toEqual('this is the correct config.xml');
    }

    it('should successfully run without template and use default hello-world app', function () {
        // Create a real project with no template
        // use default cordova-app-hello-world app
        return create(project, appId, appName, {}, events)
            .then(checkProject)
            .then(function () {
                const pkgJson = requireFresh(path.join(project, 'package.json'));
                // confirm default hello world app copies over package.json and it matched appId
                expect(pkgJson.name).toEqual(appId);
            });
    });

    it('should successfully run with Git URL', function () {
        // Create a real project with git URL as template
        const config = {
            lib: {
                www: {
                    url: 'https://github.com/apache/cordova-app-hello-world',
                    template: true
                }
            }
        };
        return createWithMockFetch(project, appId, appName, config, events)
            .then(fetchSpy => {
                expect(fetchSpy).toHaveBeenCalledTimes(1);
                expect(fetchSpy.calls.argsFor(0)[0]).toBe(config.lib.www.url);
            })
            .then(checkProject);
    });

    it('should successfully run with NPM package', function () {
        // Create a real project with npm module as template
        const config = {
            lib: {
                www: {
                    template: true,
                    url: 'phonegap-template-vue-f7-tabs@1'
                }
            }
        };
        return createWithMockFetch(project, appId, appName, config, events)
            .then(fetchSpy => {
                expect(fetchSpy).toHaveBeenCalledTimes(1);
                expect(fetchSpy.calls.argsFor(0)[0]).toBe(config.lib.www.url);
            })
            .then(checkProject);
    });

    it('should successfully run with NPM package and explicitly fetch latest if no version is given', function () {
        // Create a real project with npm module as template
        // TODO fetch should be responsible for the cache busting part of this test
        const config = {
            lib: {
                www: {
                    template: true,
                    url: 'phonegap-template-vue-f7-tabs'
                }
            }
        };
        return createWithMockFetch(project, appId, appName, config, events)
            .then(fetchSpy => {
                expect(fetchSpy).toHaveBeenCalledTimes(1);
                expect(fetchSpy.calls.argsFor(0)[0]).toBe(config.lib.www.url + '@latest');
            })
            .then(checkProject);
    });

    it('should successfully run with template not having a package.json at toplevel', function () {
        const config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'nopackage_json')
                }
            }
        };
        return create(project, appId, appName, config, events)
            .then(checkProject)
            .then(function () {
                // Check that we got the right config.xml
                const configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.description()).toEqual('this is the very correct config.xml');
            });
    });

    it('should successfully run with template having package.json and no sub directory', function () {
        const config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'withpackage_json')
                }
            }
        };
        return create(project, appId, appName, config, events)
            .then(checkProject);
    });

    it('should successfully run with template having package.json, and subdirectory, and no package.json in subdirectory', function () {
        const config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'withsubdirectory')
                }
            }
        };
        return create(project, appId, appName, config, events)
            .then(checkProject);
    });

    it('should successfully run with template having package.json, and subdirectory, and package.json in subdirectory', function () {
        const config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'withsubdirectory_package_json')
                }
            }
        };
        return create(project, appId, appName, config, events)
            .then(checkSubDir);
    });

    it('should successfully run config.xml in the www folder and move it outside', function () {
        const config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'config_in_www')
                }
            }
        };
        return create(project, appId, appName, config, events)
            .then(checkConfigXml);
    });

    it('should successfully run with www folder as the template', function () {
        const config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'templates', 'config_in_www', 'www')
                }
            }
        };
        return create(project, appId, appName, config, events)
            .then(checkConfigXml);
    });

    it('should successfully run with existing, empty destination', function () {
        fs.ensureDirSync(project);
        return create(project, appId, appName, {}, events)
            .then(checkProject);
    });

    describe('when --link-to is provided', function () {
        function allowSymlinkErrorOnWindows (err) {
            const onWindows = process.platform.slice(0, 3) === 'win';
            const isSymlinkError = err && String(err.message).startsWith('Symlinks on Windows');
            if (onWindows && isSymlinkError) {
                pending(err.message);
            } else {
                throw err;
            }
        }

        it('when passed www folder should not move www/config.xml, only copy and update', function () {
            function checkSymWWW () {
                // Check if top level dirs exist.
                const dirs = ['hooks', 'platforms', 'plugins', 'www'];
                dirs.forEach(function (d) {
                    expect(path.join(project, d)).toExist();
                });
                expect(path.join(project, 'hooks', 'README.md')).toExist();

                // Check if www files exist.
                expect(path.join(project, 'www', 'index.html')).toExist();

                // Check www/config exists
                expect(path.join(project, 'www', 'config.xml')).toExist();

                // Check www/config.xml was not updated.
                const configXml1 = new ConfigParser(path.join(project, 'www', 'config.xml'));
                expect(configXml1.packageName()).toEqual('io.cordova.hellocordova');
                expect(configXml1.version()).toEqual('0.0.1');
                expect(configXml1.description()).toEqual('this is the correct config.xml');

                // Check that config.xml was copied to project/config.xml
                expect(path.join(project, 'config.xml')).toExist();

                // Check project/config.xml was updated.
                const configXml2 = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml2.description()).toEqual('this is the correct config.xml');
                expect(configXml2.packageName()).toEqual(appId);
                expect(configXml2.version()).toEqual('1.0.0');

                // Check that we got no package.json
                expect(path.join(project, 'package.json')).not.toExist();

                // Check that www is really a symlink,
                // and project/config.xml , hooks and merges are not
                expect(fs.lstatSync(path.join(project, 'www')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'hooks')).isSymbolicLink()).not.toBe(true);
                expect(fs.lstatSync(path.join(project, 'config.xml')).isSymbolicLink()).not.toBe(true);
            }
            const config = {
                lib: {
                    www: {
                        template: true,
                        url: path.join(__dirname, 'templates', 'config_in_www', 'www'),
                        link: true
                    }
                }
            };
            return create(project, appId, appName, config, events)
                .then(checkSymWWW)
                .catch(allowSymlinkErrorOnWindows);
        });

        it('with subdirectory should not update symlinked project/config.xml', function () {
            function checkSymSubDir () {
                // Check if top level dirs exist.
                const dirs = ['hooks', 'platforms', 'plugins', 'www'];
                dirs.forEach(function (d) {
                    expect(path.join(project, d)).toExist();
                });
                expect(path.join(project, 'hooks', 'README.md')).toExist();

                // index.js and template subdir folder should not exist (inner files should be copied to the project folder)
                expect(path.join(project, 'index.js')).not.toExist();
                expect(path.join(project, 'template')).not.toExist();

                // Check if www files exist.
                expect(path.join(project, 'www', 'index.html')).toExist();

                // Check that www, and config.xml is really a symlink
                expect(fs.lstatSync(path.join(project, 'www')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'config.xml')).isSymbolicLink()).toBe(true);

                // Check that config.xml was not updated. (symlinked config does not get updated!)
                const configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.packageName()).toEqual('io.cordova.hellocordova');
                expect(configXml.version()).toEqual('0.0.1');

                // Check that we got the right config.xml
                expect(configXml.description()).toEqual('this is the correct config.xml');

                // Check that we got package.json (the correct one) and it was changed
                const pkjson = requireFresh(path.join(project, 'package.json'));
                // Pkjson.name should equal config's id.
                expect(pkjson.name).toEqual(appId.toLowerCase());
                expect(pkjson.valid).toEqual('true');
            }
            const config = {
                lib: {
                    www: {
                        template: true,
                        url: path.join(__dirname, 'templates', 'withsubdirectory_package_json'),
                        link: true
                    }
                }
            };
            return create(project, appId, appName, config, events)
                .then(checkSymSubDir)
                .catch(allowSymlinkErrorOnWindows);
        });

        it('with no config should create one and update it', function () {
            function checkSymNoConfig () {
                // Check if top level dirs exist.
                const dirs = ['hooks', 'platforms', 'plugins', 'www'];
                dirs.forEach(function (d) {
                    expect(path.join(project, d)).toExist();
                });
                expect(path.join(project, 'hooks', 'hooks.file')).toExist();
                expect(path.join(project, 'merges', 'merges.file')).toExist();

                // Check if www files exist.
                expect(path.join(project, 'www', 'index.html')).toExist();

                // Check that config.xml was updated.
                const configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.packageName()).toEqual(appId);

                // Check that www, hooks, merges are really a symlink; config is not
                expect(fs.lstatSync(path.join(project, 'www')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'hooks')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'merges')).isSymbolicLink()).toBe(true);
                expect(fs.lstatSync(path.join(project, 'config.xml')).isSymbolicLink()).not.toBe(true);
            }

            const config = {
                lib: {
                    www: {
                        template: true,
                        url: path.join(__dirname, 'templates', 'noconfig'),
                        link: true
                    }
                }
            };
            return create(project, appId, appName, config, events)
                .then(checkSymNoConfig)
                .catch(allowSymlinkErrorOnWindows);
        });

    });
});

describe('when shit happens', function () {
    it('should fail when dir is missing', function () {
        return expectRejection(
            create(null, appId, appName, {}, events),
            new CordovaError('Directory not specified')
        );
    });

    it('should fail when dir already exists', function () {
        return expectRejection(
            create(__dirname, appId, appName, {}, events),
            new CordovaError('Path already exists and is not empty')
        );
    });

    it('should fail when destination is inside template', function () {
        const config = {
            lib: {
                www: {
                    url: path.join(tmpDir, 'template')
                }
            }
        };
        const destination = path.join(config.lib.www.url, 'destination');
        return expectRejection(
            create(destination, appId, appName, config, events),
            new CordovaError('inside the template')
        );
    });

    it('should fail when fetch fails', function () {
        const config = {
            lib: {
                www: {
                    template: true,
                    url: 'http://localhost:123456789/cordova-create'
                }
            }
        };
        const fetchError = new Error('Fetch fail');
        const failingFetch = jasmine.createSpy('failingFetch')
            .and.callFake(() => Promise.reject(fetchError));
        return expectRejection(
            createWith({fetch: failingFetch})(project, appId, appName, config),
            fetchError
        );

    });

    it('should fail when template does not exist', function () {
        const config = {
            lib: {
                www: {
                    url: path.join(__dirname, 'doesnotexist')
                }
            }
        };
        return expectRejection(
            create(project, appId, appName, config, events),
            new CordovaError('Could not find directory')
        );
    });
});
