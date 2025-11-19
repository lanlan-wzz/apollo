/*
 * Copyright 2024 Apollo Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

roleTemplate_module.controller('RoleTemplateDetailController',
    ['$scope', '$window', '$location', '$timeout', 'toastr', 'AppUtil', 'PermissionService', 'RoleTemplateService', 'AppService', 'EnvService', 'UserService',
        RoleTemplateDetailController]);

function RoleTemplateDetailController($scope, $window, $location, $timeout, toastr, AppUtil, PermissionService, RoleTemplateService, AppService, EnvService, UserService) {

    // ==================== 初始化数据 ====================

    // 从URL参数中获取模板名称
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        var results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    $scope.templateName = getUrlParameter('templateName');

    $scope.environments = [];
    $scope.selectedApp = null;
    $scope.selectedAppPermissions = {
        appLevel: {}
    };
    $scope.appSearchKey = '';
    $scope.permissionMatrixCache = {};
    $scope.permissionMatrixLoading = {};

    // 权限类型配置
    $scope.systemPermissionConfigs = {
        'CreateApplication': {
            displayName: '创建应用',
            description: '允许用户创建新的应用'
        }
    };

    $scope.appLevelPermissionConfigs = {
        'CreateCluster': {
            displayName: '创建集群',
            description: '允许用户创建新的集群'
        },
        'CreateNamespace': {
            displayName: '创建命名空间',
            description: '允许用户创建新的命名空间'
        },
        'AssignRole': {
            displayName: '分配角色',
            description: '允许用户分配角色权限'
        },
        'ManageAppMaster': {
            displayName: '管理应用负责人',
            description: '允许用户管理应用的负责人'
        }
    };

    $scope.permissionTypeMap = {
        'CreateApplication': '创建应用',
        'CreateCluster': '创建集群',
        'CreateNamespace': '创建命名空间',
        'AssignRole': '分配角色',
        'ManageAppMaster': '管理应用负责人',
        'ModifyNamespace': '修改配置',
        'ReleaseNamespace': '发布配置',
        'ModifyNamespacesInCluster': '修改集群下所有命名空间',
        'ReleaseNamespacesInCluster': '发布集群下所有命名空间'
    };

    // 系统权限状态
    $scope.systemPermissionStates = {};

    // 模板详情数据
    $scope.templateDetail = {
        templateName: $scope.templateName,
        permissionSummary: {
            templateName: $scope.templateName,
            systemPermissions: [],
            appPermissions: []
        },
        loadingSummary: false,
        userCount: 0
    };

    // 初始化
    initPermission();

    function initPermission() {
        PermissionService.has_root_permission()
            .then(function (result) {
                $scope.isRootUser = result.hasPermission;
                if ($scope.isRootUser) {
                    loadEnvironments();
                    loadTemplateDetail();
                }
            });
    }

    // 加载环境列表
    function loadEnvironments() {
        EnvService.find_all_envs().then(function (result) {
            $scope.environments = result || [];
        });
    }

    // 加载模板详情
    function loadTemplateDetail() {
        $scope.templateDetail.loadingSummary = true;

        RoleTemplateService.get_template_permission_summary($scope.templateDetail.templateName)
            .then(function (summary) {
                $scope.templateDetail.permissionSummary = summary;
                $scope.templateDetail.loadingSummary = false;

                // 初始化系统权限状态
                initSystemPermissionStates(summary.systemPermissions);

                // 如果有应用，默认选择第一个
                if (summary.appPermissions && summary.appPermissions.length > 0) {
                    $scope.selectApp(summary.appPermissions[0]);
                }
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '加载权限汇总失败');
                $scope.templateDetail.loadingSummary = false;
            });

        // 加载模板基本信息
        RoleTemplateService.list_all_templates()
            .then(function (templates) {
                var template = templates.find(function (t) {
                    return t.templateName === $scope.templateDetail.templateName;
                });
                if (template) {
                    $scope.templateDetail.userCount = template.userCount;
                    $scope.templateDetail.description = template.description;
                }
            });
    }

    function ensurePermissionMatrix(appId, onFinished) {
        if (!appId) {
            return;
        }
        if ($scope.permissionMatrixCache[appId]) {
            if (onFinished) {
                onFinished($scope.permissionMatrixCache[appId]);
            }
            return;
        }
        if ($scope.permissionMatrixLoading[appId]) {
            if (onFinished) {
                var unwatch = null;
                unwatch = $scope.$watch(function () {
                    return $scope.permissionMatrixLoading[appId];
                }, function (loading) {
                    if (!loading) {
                        if (unwatch) {
                            unwatch();
                            unwatch = null;
                        }
                        onFinished($scope.permissionMatrixCache[appId]);
                    }
                });
            }
            return;
        }
        $scope.permissionMatrixLoading[appId] = true;
        RoleTemplateService.get_permission_matrix(appId)
            .then(function (matrix) {
                $scope.permissionMatrixCache[appId] = enrichPermissionMatrix(matrix || {});
                $scope.permissionMatrixLoading[appId] = false;
                if (onFinished) {
                    onFinished($scope.permissionMatrixCache[appId]);
                }
            }, function (reason) {
                $scope.permissionMatrixLoading[appId] = false;
                toastr.error(AppUtil.errorMsg(reason), '加载应用权限元数据失败');
            });
    }

    function enrichPermissionMatrix(matrix) {
        var envTargets = matrix.envTargets || [];
        var namespaceIndex = {};
        var clusterIndex = {};

        envTargets.forEach(function (envTarget) {
            var envName = envTarget.env;
            var clusters = envTarget.clusters || [];
            if (envName) {
                clusterIndex[envName] = clusters.map(function (cluster) {
                    return cluster.clusterName;
                }).filter(function (name) {
                    return !!name;
                }).sort();
            }
            clusters.forEach(function (cluster) {
                var namespaces = cluster.namespaces || [];
                namespaces.forEach(function (ns) {
                    if (!ns) {
                        return;
                    }
                    if (!namespaceIndex[ns]) {
                        namespaceIndex[ns] = {
                            envs: []
                        };
                    }
                    if (envName && namespaceIndex[ns].envs.indexOf(envName) === -1) {
                        namespaceIndex[ns].envs.push(envName);
                    }
                });
            });
        });

        Object.keys(namespaceIndex).forEach(function (key) {
            namespaceIndex[key].envs.sort();
        });

        matrix.namespaceIndex = namespaceIndex;
        matrix.clusterIndex = clusterIndex;
        matrix.namespaceOptions = Object.keys(namespaceIndex).sort(function (a, b) {
            return a.localeCompare(b);
        });
        matrix.clusterEnvOptions = Object.keys(clusterIndex).sort();
        return matrix;
    }

    function getNamespaceOptions(appId) {
        var matrix = $scope.permissionMatrixCache[appId];
        if (!matrix || !matrix.namespaceOptions) {
            return [];
        }
        return matrix.namespaceOptions;
    }

    function getNamespaceEnvOptions(appId, namespaceName) {
        var matrix = $scope.permissionMatrixCache[appId];
        if (!matrix || !matrix.namespaceIndex || !matrix.namespaceIndex[namespaceName]) {
            return [];
        }
        return matrix.namespaceIndex[namespaceName].envs || [];
    }

    function getClusterEnvOptions(appId) {
        var matrix = $scope.permissionMatrixCache[appId];
        if (!matrix || !matrix.clusterEnvOptions) {
            return [];
        }
        return matrix.clusterEnvOptions;
    }

    function getClusterOptions(appId, env) {
        var matrix = $scope.permissionMatrixCache[appId];
        if (!matrix || !matrix.clusterIndex || !matrix.clusterIndex[env]) {
            return [];
        }
        return matrix.clusterIndex[env];
    }

    // 初始化系统权限状态
    function initSystemPermissionStates(systemPermissions) {
        // 重置所有系统权限状态
        Object.keys($scope.systemPermissionConfigs).forEach(function (permType) {
            $scope.systemPermissionStates[permType] = false;
        });

        // 设置当前拥有的系统权限
        if (systemPermissions) {
            systemPermissions.forEach(function (permType) {
                $scope.systemPermissionStates[permType] = true;
            });
        }
    }

    // ==================== 辅助方法 ====================

    $scope.getSystemPermissionCount = function () {
        if (!$scope.templateDetail.permissionSummary) return 0;
        return $scope.templateDetail.permissionSummary.systemPermissions.length;
    };

    $scope.getAppCount = function () {
        if (!$scope.templateDetail.permissionSummary) return 0;
        return $scope.templateDetail.permissionSummary.appPermissions.length;
    };

    $scope.getFilteredApps = function () {
        if (!$scope.templateDetail.permissionSummary) return [];

        var apps = $scope.templateDetail.permissionSummary.appPermissions || [];

        if (!$scope.appSearchKey) {
            return apps;
        }

        var keyword = $scope.appSearchKey.toLowerCase();
        return apps.filter(function (app) {
            return app.appId.toLowerCase().indexOf(keyword) !== -1;
        });
    };

    $scope.getAppPermissionStats = function (app) {
        if (!app) return '0+0+0';

        var appLevelCount = app.appLevelPermissions ? app.appLevelPermissions.length : 0;
        var namespaceCount = app.namespacePermissions ? app.namespacePermissions.length : 0;
        var clusterCount = app.clusterPermissions ? app.clusterPermissions.length : 0;

        return appLevelCount + '+' + namespaceCount + '+' + clusterCount;
    };

    $scope.getPermissionDisplayName = function (permissionType) {
        return $scope.permissionTypeMap[permissionType] || permissionType;
    };

    // ==================== 应用选择 ====================

    $scope.selectApp = function (app) {
        $scope.selectedApp = app;

        // 初始化应用级权限状态
        $scope.selectedAppPermissions = {
            appLevel: {}
        };

        // 重置所有应用级权限
        Object.keys($scope.appLevelPermissionConfigs).forEach(function (permType) {
            $scope.selectedAppPermissions.appLevel[permType] = false;
        });

        // 设置当前应用的权限状态
        if (app.appLevelPermissions) {
            app.appLevelPermissions.forEach(function (permType) {
                $scope.selectedAppPermissions.appLevel[permType] = true;
            });
        }

        ensurePermissionMatrix(app.appId);
    };

    // ==================== 系统权限管理 ====================

    $scope.updateSystemPermission = function (permissionType) {
        var isEnabled = $scope.systemPermissionStates[permissionType];

        if (isEnabled) {
            // 添加系统权限
            var apps = [{
                appId: 'SystemRole',
                permissionTypes: [permissionType],
                namespaceName: null,
                env: null
            }];

            RoleTemplateService.add_apps_to_template($scope.templateDetail.templateName, apps)
                .then(function () {
                    toastr.success('系统权限已添加');
                    loadTemplateDetail();
                }, function (reason) {
                    toastr.error(AppUtil.errorMsg(reason), '添加系统权限失败');
                    // 回滚状态
                    $scope.systemPermissionStates[permissionType] = false;
                });
        } else {
            // 移除系统权限
            RoleTemplateService.remove_system_permission($scope.templateDetail.templateName, permissionType)
                .then(function () {
                    toastr.success('系统权限已移除');
                    loadTemplateDetail();
                }, function (reason) {
                    toastr.error(AppUtil.errorMsg(reason), '移除系统权限失败');
                    // 回滚状态
                    $scope.systemPermissionStates[permissionType] = true;
                });
        }
    };

    // ==================== 应用级权限管理 ====================

    $scope.updateAppLevelPermission = function (permissionType) {
        if (!$scope.selectedApp) return;

        var isEnabled = $scope.selectedAppPermissions.appLevel[permissionType];

        if (isEnabled) {
            // 添加应用级权限
            var apps = [{
                appId: $scope.selectedApp.appId,
                permissionTypes: [permissionType],
                namespaceName: null,
                env: null
            }];

            RoleTemplateService.add_apps_to_template($scope.templateDetail.templateName, apps)
                .then(function () {
                    toastr.success('应用权限已添加');
                    loadTemplateDetail();
                }, function (reason) {
                    toastr.error(AppUtil.errorMsg(reason), '添加应用权限失败');
                    // 回滚状态
                    $scope.selectedAppPermissions.appLevel[permissionType] = false;
                });
        } else {
            // 移除应用级权限
            RoleTemplateService.remove_app_permission($scope.templateDetail.templateName,
                $scope.selectedApp.appId, permissionType)
                .then(function () {
                    toastr.success('应用权限已移除');
                    loadTemplateDetail();
                }, function (reason) {
                    toastr.error(AppUtil.errorMsg(reason), '移除应用权限失败');
                    // 回滚状态
                    $scope.selectedAppPermissions.appLevel[permissionType] = true;
                });
        }
    };

    // ==================== 命名空间权限管理 ====================

    $scope.showAddNamespaceModal = function () {
        if (!$scope.selectedApp) {
            toastr.warning('请先选择一个应用');
            return;
        }

        ensurePermissionMatrix($scope.selectedApp.appId, function () {
            var namespaceOptions = getNamespaceOptions($scope.selectedApp.appId);
            var defaultNamespace = namespaceOptions.length > 0 ? namespaceOptions[0] : 'application';

            $scope.addNamespaceData = {
                appId: $scope.selectedApp.appId,
                namespaceName: defaultNamespace,
                env: '',
                namespaceOptions: namespaceOptions,
                availableEnvs: [],
                permissions: {
                    ModifyNamespace: false,
                    ReleaseNamespace: false
                }
            };

            updateNamespaceEnvOptionsInternal();

            $timeout(function () {
                $('#addNamespaceModal').modal('show');
            });
        });
    };

    function updateNamespaceEnvOptionsInternal() {
        if (!$scope.addNamespaceData) {
            return;
        }

        var envOptions = getNamespaceEnvOptions($scope.addNamespaceData.appId, $scope.addNamespaceData.namespaceName);
        $scope.addNamespaceData.availableEnvs = envOptions;
        if ($scope.addNamespaceData.env && envOptions.indexOf($scope.addNamespaceData.env) === -1) {
            $scope.addNamespaceData.env = '';
        }
    }

    $scope.onNamespaceChange = function () {
        updateNamespaceEnvOptionsInternal();
    };

    $scope.confirmAddNamespace = function () {
        if (!$scope.addNamespaceData.namespaceName || !$scope.addNamespaceData.namespaceName.trim()) {
            toastr.warning('请输入Namespace名称');
            return;
        }

        var permissionTypes = [];
        if ($scope.addNamespaceData.permissions.ModifyNamespace) {
            permissionTypes.push('ModifyNamespace');
        }
        if ($scope.addNamespaceData.permissions.ReleaseNamespace) {
            permissionTypes.push('ReleaseNamespace');
        }

        if (permissionTypes.length === 0) {
            toastr.warning('请至少选择一个权限类型');
            return;
        }

        var apps = [{
            appId: $scope.addNamespaceData.appId,
            namespaceName: $scope.addNamespaceData.namespaceName.trim(),
            env: $scope.addNamespaceData.env || null,
            permissionTypes: permissionTypes
        }];

        RoleTemplateService.add_apps_to_template($scope.templateDetail.templateName, apps)
            .then(function () {
                toastr.success('添加Namespace权限成功');
                $('#addNamespaceModal').modal('hide');
                loadTemplateDetail();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '添加失败');
            });
    };

    $scope.removeNamespacePermission = function (namespace) {
        if (!confirm('确认删除命名空间 "' + namespace.namespaceName + '" 的权限吗？')) {
            return;
        }

        RoleTemplateService.remove_namespace_permission($scope.templateDetail.templateName,
            $scope.selectedApp.appId, namespace.namespaceName, namespace.env)
            .then(function () {
                toastr.success('删除成功');
                loadTemplateDetail();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '删除失败');
            });
    };

    // ==================== 集群权限管理 ====================

    $scope.showAddClusterModal = function () {
        if (!$scope.selectedApp) {
            toastr.warning('请先选择一个应用');
            return;
        }

        ensurePermissionMatrix($scope.selectedApp.appId, function () {
            var envOptions = getClusterEnvOptions($scope.selectedApp.appId);
            var defaultEnv = envOptions.length > 0 ? envOptions[0] : '';
            var clusterOptions = getClusterOptions($scope.selectedApp.appId, defaultEnv);
            var defaultCluster = clusterOptions.length > 0 ? clusterOptions[0] : 'default';

            $scope.addClusterData = {
                appId: $scope.selectedApp.appId,
                clusterName: defaultCluster,
                env: defaultEnv,
                availableEnvs: envOptions,
                clusterOptions: clusterOptions,
                permissions: {
                    ModifyNamespacesInCluster: false,
                    ReleaseNamespacesInCluster: false
                }
            };

            $timeout(function () {
                $('#addClusterModal').modal('show');
            });
        });
    };

    function refreshClusterOptions() {
        if (!$scope.addClusterData) {
            return;
        }
        var clusters = getClusterOptions($scope.addClusterData.appId, $scope.addClusterData.env);
        $scope.addClusterData.clusterOptions = clusters;
        if ($scope.addClusterData.clusterName && clusters.indexOf($scope.addClusterData.clusterName) === -1) {
            $scope.addClusterData.clusterName = clusters.length > 0 ? clusters[0] : '';
        }
    }

    $scope.onClusterEnvChange = function () {
        refreshClusterOptions();
    };

    $scope.confirmAddCluster = function () {
        if (!$scope.addClusterData.clusterName || !$scope.addClusterData.clusterName.trim()) {
            toastr.warning('请输入集群名称');
            return;
        }

        if (!$scope.addClusterData.env) {
            toastr.warning('请选择环境');
            return;
        }

        var permissionTypes = [];
        if ($scope.addClusterData.permissions.ModifyNamespacesInCluster) {
            permissionTypes.push('ModifyNamespacesInCluster');
        }
        if ($scope.addClusterData.permissions.ReleaseNamespacesInCluster) {
            permissionTypes.push('ReleaseNamespacesInCluster');
        }

        if (permissionTypes.length === 0) {
            toastr.warning('请至少选择一个权限类型');
            return;
        }

        var apps = [{
            appId: $scope.addClusterData.appId,
            clusterName: $scope.addClusterData.clusterName.trim(),
            env: $scope.addClusterData.env,
            permissionTypes: permissionTypes
        }];

        RoleTemplateService.add_apps_to_template($scope.templateDetail.templateName, apps)
            .then(function () {
                toastr.success('添加集群权限成功');
                $('#addClusterModal').modal('hide');
                loadTemplateDetail();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '添加失败');
            });
    };

    $scope.removeClusterPermission = function (cluster) {
        if (!confirm('确认删除集群 "' + cluster.clusterName + '" 的权限吗？')) {
            return;
        }

        RoleTemplateService.remove_cluster_permission($scope.templateDetail.templateName,
            $scope.selectedApp.appId, cluster.clusterName, cluster.env)
            .then(function () {
                toastr.success('删除成功');
                loadTemplateDetail();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '删除失败');
            });
    };

    // ==================== 应用管理 ====================

    $scope.removeAppFromTemplate = function (appId) {
        if (!confirm('确认从角色模板中移除应用 "' + appId + '" 的所有权限吗？')) {
            return;
        }

        RoleTemplateService.remove_app_from_template($scope.templateDetail.templateName, appId)
            .then(function () {
                toastr.success('移除成功');

                // 如果移除的是当前选中的应用，清空选择
                if ($scope.selectedApp && $scope.selectedApp.appId === appId) {
                    $scope.selectedApp = null;
                }

                loadTemplateDetail();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '移除失败');
            });
    };

    // ==================== 添加应用功能 ====================

    $scope.showAddAppsModal = function () {
        // 先初始化数据
        $scope.addAppsData = {
            templateName: $scope.templateDetail.templateName,
            currentStep: 1,
            selectedApps: [],
            allApps: [],
            searchAppKey: '',
            loadingApps: true, // 修改：初始状态设为加载中
            selectAllApps: false,
            defaultPermissions: {
                CreateNamespace: false,
                CreateCluster: false,
                AssignRole: false,
                ModifyNamespace: false,
                ReleaseNamespace: false
            },
            defaultNamespace: 'application',
            defaultEnv: '',
            skipDefaultPermissions: false
        };

        // 先加载数据，然后显示模态框
        loadAllApps();

        // 使用$timeout确保Angular已处理完数据绑定
        $timeout(function () {
            // 显示模态框
            $('#addAppsModal').modal({
                backdrop: 'static',
                keyboard: false
            });
        }, 100);
    };

    function loadAllApps() {
        if (!$scope.addAppsData) {
            console.error('addAppsData is not initialized');
            return;
        }

        $scope.addAppsData.loadingApps = true;
        console.log('Loading apps...');

        AppService.find_apps().then(function (result) {
            console.log('Apps loaded:', result);
            if ($scope.addAppsData) {
                $scope.addAppsData.allApps = result || [];
                $scope.addAppsData.loadingApps = false;
            }
        }, function (reason) {
            console.error('Failed to load apps:', reason);
            toastr.error(AppUtil.errorMsg(reason), '加载应用列表失败');
            if ($scope.addAppsData) {
                $scope.addAppsData.loadingApps = false;
            }
        });
    }

    $scope.searchApps = function () {
        if (!$scope.addAppsData || !$scope.addAppsData.allApps) {
            return [];
        }
        if (!$scope.addAppsData.searchAppKey) {
            return $scope.addAppsData.allApps;
        }
        var keyword = $scope.addAppsData.searchAppKey.toLowerCase();
        return $scope.addAppsData.allApps.filter(function (app) {
            return app.appId.toLowerCase().indexOf(keyword) !== -1 ||
                (app.name && app.name.toLowerCase().indexOf(keyword) !== -1);
        });
    };

    $scope.toggleAppSelection = function (app) {
        var index = $scope.addAppsData.selectedApps.findIndex(function (a) {
            return a.appId === app.appId;
        });

        if (index > -1) {
            $scope.addAppsData.selectedApps.splice(index, 1);
        } else {
            $scope.addAppsData.selectedApps.push(app);
        }

        updateSelectAllAppsStatus();
    };

    $scope.isAppSelected = function (app) {
        if (!$scope.addAppsData || !$scope.addAppsData.selectedApps) {
            return false;
        }
        return $scope.addAppsData.selectedApps.some(function (a) {
            return a.appId === app.appId;
        });
    };

    $scope.toggleSelectAllApps = function () {
        var filteredApps = $scope.searchApps();

        if ($scope.addAppsData.selectAllApps) {
            // 取消全选
            filteredApps.forEach(function (app) {
                var index = $scope.addAppsData.selectedApps.findIndex(function (a) {
                    return a.appId === app.appId;
                });
                if (index > -1) {
                    $scope.addAppsData.selectedApps.splice(index, 1);
                }
            });
            $scope.addAppsData.selectAllApps = false;
        } else {
            // 全选
            filteredApps.forEach(function (app) {
                var index = $scope.addAppsData.selectedApps.findIndex(function (a) {
                    return a.appId === app.appId;
                });
                if (index === -1) {
                    $scope.addAppsData.selectedApps.push(app);
                }
            });
            $scope.addAppsData.selectAllApps = true;
        }
    };

    function updateSelectAllAppsStatus() {
        var filteredApps = $scope.searchApps();
        if (filteredApps.length === 0) {
            $scope.addAppsData.selectAllApps = false;
            return;
        }

        var allSelected = filteredApps.every(function (app) {
            return $scope.isAppSelected(app);
        });

        $scope.addAppsData.selectAllApps = allSelected;
    }

    $scope.nextStepToPermissions = function () {
        if ($scope.addAppsData.selectedApps.length === 0) {
            toastr.warning('请至少选择一个应用');
            return;
        }
        $scope.addAppsData.currentStep = 2;
    };

    $scope.previousStepToApps = function () {
        $scope.addAppsData.currentStep = 1;
    };

    $scope.confirmAddApps = function () {
        if ($scope.addAppsData.selectedApps.length === 0) {
            toastr.warning('请至少选择一个应用');
            return;
        }

        // 使用Map来聚合权限
        var appsMap = {};

        // 如果跳过默认权限配置，只添加应用（不添加具体权限）
        if ($scope.addAppsData.skipDefaultPermissions) {
            $scope.addAppsData.selectedApps.forEach(function (app) {
                var key = app.appId + '_application_';
                if (!appsMap[key]) {
                    appsMap[key] = {
                        appId: app.appId,
                        namespaceName: 'application',
                        env: null,
                        permissionTypes: []
                    };
                }
                appsMap[key].permissionTypes.push('ModifyNamespace');
            });
        } else {
            // 为每个应用添加默认权限
            $scope.addAppsData.selectedApps.forEach(function (app) {
                // 应用级权限（没有namespaceName）
                var appLevelPermissions = [];
                if ($scope.addAppsData.defaultPermissions.CreateNamespace) {
                    appLevelPermissions.push('CreateNamespace');
                }
                if ($scope.addAppsData.defaultPermissions.CreateCluster) {
                    appLevelPermissions.push('CreateCluster');
                }
                if ($scope.addAppsData.defaultPermissions.AssignRole) {
                    appLevelPermissions.push('AssignRole');
                }

                if (appLevelPermissions.length > 0) {
                    var appKey = app.appId + '__';
                    appsMap[appKey] = {
                        appId: app.appId,
                        namespaceName: null,
                        env: null,
                        permissionTypes: appLevelPermissions
                    };
                }

                // Namespace权限
                var namespaceLevelPermissions = [];
                if ($scope.addAppsData.defaultPermissions.ModifyNamespace) {
                    namespaceLevelPermissions.push('ModifyNamespace');
                }
                if ($scope.addAppsData.defaultPermissions.ReleaseNamespace) {
                    namespaceLevelPermissions.push('ReleaseNamespace');
                }

                if (namespaceLevelPermissions.length > 0) {
                    if (!$scope.addAppsData.defaultNamespace ||
                        !$scope.addAppsData.defaultNamespace.trim()) {
                        toastr.warning('请输入Namespace名称');
                        return;
                    }

                    var nsKey = app.appId + '_' + $scope.addAppsData.defaultNamespace.trim() + '_' + ($scope.addAppsData.defaultEnv || '');
                    appsMap[nsKey] = {
                        appId: app.appId,
                        namespaceName: $scope.addAppsData.defaultNamespace.trim(),
                        env: $scope.addAppsData.defaultEnv || null,
                        permissionTypes: namespaceLevelPermissions
                    };
                }
            });
        }

        var apps = Object.keys(appsMap).map(function (key) {
            return appsMap[key];
        });

        if (apps.length === 0) {
            toastr.warning('请至少配置一个权限');
            return;
        }

        RoleTemplateService.add_apps_to_template($scope.addAppsData.templateName, apps)
            .then(function (result) {
                toastr.success('添加应用成功');
                $('#addAppsModal').modal('hide');
                loadTemplateDetail();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '添加应用失败');
            });
    };

    $scope.cancelAddApps = function () {
        // 先清理数据
        $scope.addAppsData = null;

        // 然后关闭模态框
        $timeout(function() {
            $('#addAppsModal').modal('hide');
        });
    };

    // 监听搜索应用输入，更新全选状态
    $scope.$watch('addAppsData.searchAppKey', function (newVal, oldVal) {
        if ($scope.addAppsData && newVal !== oldVal) {
            updateSelectAllAppsStatus();
        }
    });

    // ==================== 用户管理功能 ====================

    $scope.showAssignedUsersModal = function () {
        $scope.assignedUsersData = {
            templateName: $scope.templateDetail.templateName,
            users: [],
            searchKey: '',
            loading: false
        };

        $timeout(function () {
            $('#assignedUsersModal').modal({
                backdrop: 'static',
                keyboard: true
            });
            loadAssignedUsers();
        });
    };

    function loadAssignedUsers() {
        if (!$scope.assignedUsersData) return;

        $scope.assignedUsersData.loading = true;
        RoleTemplateService.get_template_users($scope.assignedUsersData.templateName)
            .then(function (result) {
                $scope.assignedUsersData.users = result || [];
                $scope.assignedUsersData.loading = false;

                // 强制触发digest
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '加载用户列表失败');
                $scope.assignedUsersData.loading = false;

                // 强制触发digest
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            });
    }

    $scope.removeUserFromTemplateInModal = function (userId) {
        if (!confirm('确认将用户 "' + userId + '" 从角色模板中移除吗？')) {
            return;
        }

        RoleTemplateService.remove_users_from_template($scope.assignedUsersData.templateName, [userId])
            .then(function () {
                toastr.success('移除用户成功');
                loadAssignedUsers();
                // 更新用户数量
                if ($scope.templateDetail.userCount > 0) {
                    $scope.templateDetail.userCount--;
                }
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '移除用户失败');
            });
    };

    // ==================== 分配用户功能 ====================

    $scope.showAssignUsersModal = function () {
        $scope.assignUsersData = {
            templateName: $scope.templateDetail.templateName,
            allUsers: [],
            selectedUsers: [],
            searchUserKey: '',
            loadingUsers: true, // 修改：初始状态设为加载中
            selectAll: false
        };

        $timeout(function () {
            // 先关闭已分配用户模态框（如果打开了）
            $('#assignedUsersModal').modal('hide');

            // 等待一小段时间后打开新模态框
            $timeout(function () {
                $('#assignUsersModal').modal({
                    backdrop: 'static',
                    keyboard: true
                });
                loadAllUsers();
            }, 300);
        });
    };

    function loadAllUsers() {
        if (!$scope.assignUsersData) return;

        $scope.assignUsersData.loadingUsers = true;
        UserService.find_users('').then(function (result) {
            $scope.assignUsersData.allUsers = result || [];
            $scope.assignUsersData.loadingUsers = false;

            // 强制触发digest
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }, function (reason) {
            toastr.error(AppUtil.errorMsg(reason), '加载用户列表失败');
            $scope.assignUsersData.loadingUsers = false;

            // 强制触发digest
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        });
    }

    $scope.searchUsers = function () {
        if (!$scope.assignUsersData || !$scope.assignUsersData.allUsers) {
            return [];
        }
        if (!$scope.assignUsersData.searchUserKey) {
            return $scope.assignUsersData.allUsers;
        }
        var keyword = $scope.assignUsersData.searchUserKey.toLowerCase();
        return $scope.assignUsersData.allUsers.filter(function (user) {
            return user.userId.toLowerCase().indexOf(keyword) !== -1 ||
                (user.name && user.name.toLowerCase().indexOf(keyword) !== -1) ||
                (user.email && user.email.toLowerCase().indexOf(keyword) !== -1);
        });
    };

    $scope.toggleUserSelection = function (user) {
        var index = $scope.assignUsersData.selectedUsers.findIndex(function (u) {
            return u.userId === user.userId;
        });

        if (index > -1) {
            $scope.assignUsersData.selectedUsers.splice(index, 1);
        } else {
            $scope.assignUsersData.selectedUsers.push(user);
        }

        updateSelectAllStatus();
    };

    $scope.isUserSelected = function (user) {
        if (!$scope.assignUsersData || !$scope.assignUsersData.selectedUsers) {
            return false;
        }
        return $scope.assignUsersData.selectedUsers.some(function (u) {
            return u.userId === user.userId;
        });
    };

    $scope.toggleSelectAll = function () {
        var filteredUsers = $scope.searchUsers();

        if ($scope.assignUsersData.selectAll) {
            // 取消全选
            filteredUsers.forEach(function (user) {
                var index = $scope.assignUsersData.selectedUsers.findIndex(function (u) {
                    return u.userId === user.userId;
                });
                if (index > -1) {
                    $scope.assignUsersData.selectedUsers.splice(index, 1);
                }
            });
            $scope.assignUsersData.selectAll = false;
        } else {
            // 全选
            filteredUsers.forEach(function (user) {
                var index = $scope.assignUsersData.selectedUsers.findIndex(function (u) {
                    return u.userId === user.userId;
                });
                if (index === -1) {
                    $scope.assignUsersData.selectedUsers.push(user);
                }
            });
            $scope.assignUsersData.selectAll = true;
        }
    };

    function updateSelectAllStatus() {
        var filteredUsers = $scope.searchUsers();
        if (filteredUsers.length === 0) {
            $scope.assignUsersData.selectAll = false;
            return;
        }

        var allSelected = filteredUsers.every(function (user) {
            return $scope.isUserSelected(user);
        });

        $scope.assignUsersData.selectAll = allSelected;
    }

    $scope.confirmAssignUsers = function () {
        if (!$scope.assignUsersData.selectedUsers || $scope.assignUsersData.selectedUsers.length === 0) {
            toastr.warning('请至少选择一个用户');
            return;
        }

        var userIds = $scope.assignUsersData.selectedUsers.map(function (user) {
            return user.userId;
        });

        RoleTemplateService.assign_users_to_template($scope.assignUsersData.templateName, userIds)
            .then(function (result) {
                toastr.success('分配用户成功');
                $('#assignUsersModal').modal('hide');

                // 更新用户数量
                $scope.templateDetail.userCount = ($scope.templateDetail.userCount || 0) + userIds.length;

                // 如果需要，重新打开已分配用户模态框
                $timeout(function () {
                    $scope.showAssignedUsersModal();
                }, 300);
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '分配用户失败');
            });
    };

    $scope.cancelAssignUsers = function () {
        $('#assignUsersModal').modal('hide');
        // 清理数据
        $scope.assignUsersData = null;

        // 重新打开已分配用户模态框
        $timeout(function () {
            $scope.showAssignedUsersModal();
        }, 300);
    };

    // 监听搜索用户输入，更新全选状态
    $scope.$watch('assignUsersData.searchUserKey', function (newVal, oldVal) {
        if ($scope.assignUsersData && newVal !== oldVal) {
            updateSelectAllStatus();
        }
    });

    // ==================== 删除模板 ====================

    $scope.deleteTemplate = function () {
        var confirmMsg = '确认删除角色模板 "' + $scope.templateDetail.templateName + '" 吗？';
        if ($scope.templateDetail.userCount > 0) {
            confirmMsg = '角色模板 "' + $scope.templateDetail.templateName + '" 还有 ' + $scope.templateDetail.userCount + ' 个用户正在使用，删除后这些用户将失去该模板下的所有权限。\n\n确认删除吗？';
        }

        if (!confirm(confirmMsg)) {
            return;
        }

        RoleTemplateService.delete_template($scope.templateDetail.templateName)
            .then(function () {
                toastr.success('删除成功');
                // 跳转回列表页
                $window.location.href = 'role-template.html';
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '删除失败');
            });
    };

    // ==================== 模态框事件监听 ====================

    // 监听模态框隐藏事件，清理数据
    $(document).ready(function () {
        // addAppsModal 的清理已在 cancelAddApps 函数中处理，不需要重复清理

        $('#assignUsersModal').on('hidden.bs.modal', function () {
            $scope.$apply(function () {
                if ($scope.assignUsersData && !$scope.assignUsersData.keepData) {
                    $scope.assignUsersData = null;
                }
            });
        });

        $('#assignedUsersModal').on('hidden.bs.modal', function () {
            $scope.$apply(function () {
                $scope.assignedUsersData = null;
            });
        });
    });
}
