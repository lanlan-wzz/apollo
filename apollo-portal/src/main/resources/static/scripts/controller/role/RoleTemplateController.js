/*
 * Copyright 2024 Apollo Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
roleTemplate_module.controller('RoleTemplateController',
    ['$scope', '$window', 'toastr', 'AppUtil', 'PermissionService', 'RoleTemplateService', 'AppService', 'EnvService', 'UserService',
        RoleTemplateController]);

function RoleTemplateController($scope, $window, toastr, AppUtil, PermissionService, RoleTemplateService, AppService, EnvService, UserService) {

    // ==================== 初始化数据 ====================
    $scope.templates = [];
    $scope.filteredTemplates = [];
    $scope.searchKey = '';
    $scope.loading = false;
    $scope.environments = [];

    // 🆕 权限类型映射（中文显示）
    $scope.permissionTypeMap = {
        // 系统级权限
        'CreateApplication': '创建应用',

        // 应用级权限
        'CreateCluster': '创建集群',
        'CreateNamespace': '创建命名空间',
        'AssignRole': '分配角色',
        'ManageAppMaster': '管理应用负责人',

        // 命名空间级权限
        'ModifyNamespace': '修改配置',
        'ReleaseNamespace': '发布配置',

        // 集群级权限
        'ModifyNamespacesInCluster': '修改集群下所有命名空间',
        'ReleaseNamespacesInCluster': '发布集群下所有命名空间'
    };

    // 初始化新模板对象
    $scope.newTemplate = {
        templateName: '',
        description: ''
    };

    // 初始化权限检查
    initPermission();

    function initPermission() {
        PermissionService.has_root_permission()
            .then(function (result) {
                $scope.isRootUser = result.hasPermission;
                if ($scope.isRootUser) {
                    loadTemplates();
                    loadEnvironments();
                }
            });
    }

    // 加载环境列表
    function loadEnvironments() {
        EnvService.find_all_envs().then(function (result) {
            $scope.environments = result || [];
        });
    }

    // 加载所有角色模板
    function loadTemplates() {
        $scope.loading = true;
        RoleTemplateService.list_all_templates()
            .then(function (result) {
                $scope.templates = result;
                $scope.filteredTemplates = result;
                $scope.loading = false;
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '加载失败');
                $scope.loading = false;
            });
    }

    // 公开 loadTemplates 方法
    $scope.loadTemplates = loadTemplates;

    // 搜索模板
    $scope.searchTemplates = function () {
        if (!$scope.searchKey) {
            $scope.filteredTemplates = $scope.templates;
            return;
        }

        var keyword = $scope.searchKey.toLowerCase();
        $scope.filteredTemplates = $scope.templates.filter(function (template) {
            return template.templateName.toLowerCase().indexOf(keyword) !== -1 ||
                (template.description && template.description.toLowerCase().indexOf(keyword) !== -1);
        });
    };

    // ==================== 创建角色模板 ====================

    $scope.showCreateTemplateModal = function () {
        // 重置表单
        $scope.newTemplate = {
            templateName: '',
            description: ''
        };
        $('#createTemplateModal').modal('show');
    };

    $scope.confirmCreateTemplate = function () {
        if (!$scope.newTemplate.templateName || !$scope.newTemplate.templateName.trim()) {
            toastr.warning('请输入模板名称');
            return;
        }

        RoleTemplateService.create_template($scope.newTemplate.templateName.trim(), $scope.newTemplate.description)
            .then(function (result) {
                toastr.success('创建成功');
                $('#createTemplateModal').modal('hide');
                loadTemplates();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '创建失败');
            });
    };

    // ==================== 模板详情 ====================

    $scope.showTemplateDetail = function (templateName) {
        // 跳转到详情页，而不是打开弹窗
        $window.location.href = 'role-template-detail.html?templateName=' + encodeURIComponent(templateName);
    };

    // 🔧 修改：使用新的权限汇总API
    function loadTemplateDetail(templateName) {
        $scope.templateDetail.loadingSummary = true;

        RoleTemplateService.get_template_permission_summary(templateName)
            .then(function (summary) {
                $scope.templateDetail.permissionSummary = summary;
                $scope.templateDetail.loadingSummary = false;

                // 🆕 处理展开状态
                summary.appPermissions.forEach(function(app) {
                    $scope.templateDetail.expandedApps[app.appId] = false;
                });
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '加载权限汇总失败');
                $scope.templateDetail.loadingSummary = false;
            });
    }

    // 🆕 新增：切换应用展开状态
    $scope.toggleAppExpanded = function(appId) {
        $scope.templateDetail.expandedApps[appId] = !$scope.templateDetail.expandedApps[appId];
    };

    // 🆕 新增：检查应用是否展开
    $scope.isAppExpanded = function(appId) {
        return $scope.templateDetail.expandedApps[appId] || false;
    };

    // 🆕 新增：获取权限类型的中文名称
    $scope.getPermissionDisplayName = function(permissionType) {
        return $scope.permissionTypeMap[permissionType] || permissionType;
    };

    // 🆕 新增：过滤应用
    $scope.getFilteredApps = function() {
        if (!$scope.templateDetail || !$scope.templateDetail.permissionSummary) {
            return [];
        }

        var apps = $scope.templateDetail.permissionSummary.appPermissions || [];

        if (!$scope.templateDetail.searchAppKey) {
            return apps;
        }

        var keyword = $scope.templateDetail.searchAppKey.toLowerCase();
        return apps.filter(function(app) {
            return app.appId.toLowerCase().indexOf(keyword) !== -1;
        });
    };

    // 🆕 新增：检查应用是否有权限
    $scope.hasAnyPermission = function(app) {
        if (!app) return false;

        return (app.appLevelPermissions && app.appLevelPermissions.length > 0) ||
            (app.namespacePermissions && app.namespacePermissions.length > 0) ||
            (app.clusterPermissions && app.clusterPermissions.length > 0);
    };

    // 🆕 新增：格式化环境显示
    $scope.formatEnvDisplay = function(env) {
        return env || '所有环境';
    };

    // 从模板移除应用
    $scope.removeAppFromTemplate = function (appId) {
        if (!confirm('确认从角色模板中移除应用 "' + appId + '" 的所有权限吗？')) {
            return;
        }

        RoleTemplateService.remove_app_from_template($scope.templateDetail.template.templateName, appId)
            .then(function () {
                toastr.success('移除成功');
                loadTemplateDetail($scope.templateDetail.template.templateName);
                loadTemplates();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '移除失败');
            });
    };

    // ==================== 系统权限管理 ====================

    $scope.showSystemPermissionsModal = function() {
        $scope.systemPermissionsData = {
            templateName: $scope.templateDetail.template.templateName,
            permissions: {
                CreateApplication: false
            },
            loading: false
        };

        // 🔧 从权限汇总中获取当前系统权限状态
        if ($scope.templateDetail.permissionSummary && $scope.templateDetail.permissionSummary.systemPermissions) {
            $scope.templateDetail.permissionSummary.systemPermissions.forEach(function(permType) {
                $scope.systemPermissionsData.permissions[permType] = true;
            });
        }

        $('#systemPermissionsModal').modal('show');
    };

    $scope.saveSystemPermissions = function() {
        var permissionTypes = [];
        Object.keys($scope.systemPermissionsData.permissions).forEach(function (permType) {
            if ($scope.systemPermissionsData.permissions[permType]) {
                permissionTypes.push(permType);
            }
        });

        var apps = [];
        // 如果有选中的系统权限，创建一个系统级权限配置
        if (permissionTypes.length > 0) {
            apps.push({
                appId: 'SystemRole', // 🔧 系统权限使用 SystemRole 作为 appId
                permissionTypes: permissionTypes,
                namespaceName: null,
                env: null
            });
        }

        $scope.systemPermissionsData.loading = true;
        RoleTemplateService.add_apps_to_template($scope.systemPermissionsData.templateName, apps)
            .then(function () {
                toastr.success('系统权限已更新');
                $('#systemPermissionsModal').modal('hide');
                loadTemplateDetail($scope.systemPermissionsData.templateName);
                loadTemplates();
                $scope.systemPermissionsData.loading = false;
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '更新系统权限失败');
                $scope.systemPermissionsData.loading = false;
            });
    };

    // ==================== 添加Namespace ====================

    $scope.showAddNamespaceModal = function (app) {
        $scope.addNamespaceData = {
            appId: app.appId,
            namespaceName: 'application',
            env: '',
            permissions: {
                ModifyNamespace: false,
                ReleaseNamespace: false
            },
            useClusterPermission: false,
            clusterName: 'default',
            clusterPermissions: {
                ModifyNamespacesInCluster: false,
                ReleaseNamespacesInCluster: false
            }
        };

        $('#addNamespaceModal').modal('show');
    };

    $scope.toggleClusterPermission = function () {
        if (!$scope.addNamespaceData.useClusterPermission) {
            $scope.addNamespaceData.clusterPermissions = {
                ModifyNamespacesInCluster: false,
                ReleaseNamespacesInCluster: false
            };
        }
    };

    $scope.confirmAddNamespace = function () {
        if (!$scope.addNamespaceData.namespaceName || !$scope.addNamespaceData.namespaceName.trim()) {
            toastr.warning('请输入Namespace名称');
            return;
        }

        var permissionTypes = [];

        if ($scope.addNamespaceData.useClusterPermission) {
            // 集群级权限
            if ($scope.addNamespaceData.clusterPermissions.ModifyNamespacesInCluster) {
                permissionTypes.push('ModifyNamespacesInCluster');
            }
            if ($scope.addNamespaceData.clusterPermissions.ReleaseNamespacesInCluster) {
                permissionTypes.push('ReleaseNamespacesInCluster');
            }
        } else {
            // Namespace级权限
            if ($scope.addNamespaceData.permissions.ModifyNamespace) {
                permissionTypes.push('ModifyNamespace');
            }
            if ($scope.addNamespaceData.permissions.ReleaseNamespace) {
                permissionTypes.push('ReleaseNamespace');
            }
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

        RoleTemplateService.add_apps_to_template($scope.templateDetail.template.templateName, apps)
            .then(function () {
                toastr.success('添加Namespace权限成功');
                $('#addNamespaceModal').modal('hide');
                loadTemplateDetail($scope.templateDetail.template.templateName);
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '添加失败');
            });
    };

    // ==================== 添加应用功能 ====================

    $scope.showAddAppsModal = function (templateName) {
        $scope.addAppsData = {
            templateName: templateName,
            currentStep: 1,
            selectedApps: [],
            allApps: [],
            searchAppKey: '',
            loadingApps: false,
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

        loadAllApps();
        $('#addAppsModal').modal('show');
    };

    function loadAllApps() {
        $scope.addAppsData.loadingApps = true;
        AppService.find_apps().then(function (result) {
            $scope.addAppsData.allApps = result || [];
            $scope.addAppsData.loadingApps = false;
        }, function (reason) {
            toastr.error(AppUtil.errorMsg(reason), '加载应用列表失败');
            $scope.addAppsData.loadingApps = false;
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

        var apps = Object.values(appsMap);

        if (apps.length === 0) {
            toastr.warning('请至少配置一个权限');
            return;
        }

        RoleTemplateService.add_apps_to_template($scope.addAppsData.templateName, apps)
            .then(function (result) {
                toastr.success('添加应用成功');
                $('#addAppsModal').modal('hide');
                loadTemplateDetail($scope.addAppsData.templateName);
                loadTemplates();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '添加应用失败');
            });
    };

    $scope.cancelAddApps = function () {
        $('#addAppsModal').modal('hide');
    };

    // 监听搜索应用输入，更新全选状态
    $scope.$watch('addAppsData.searchAppKey', function () {
        if ($scope.addAppsData) {
            updateSelectAllAppsStatus();
        }
    });

    // ==================== 分配用户功能 ====================

    $scope.showAssignUsersModal = function (templateName) {
        $scope.assignUsersData = {
            templateName: templateName,
            allUsers: [],
            selectedUsers: [],
            searchUserKey: '',
            loadingUsers: false,
            selectAll: false
        };

        loadAllUsers();
        $('#assignUsersModal').modal('show');
    };

    function loadAllUsers() {
        $scope.assignUsersData.loadingUsers = true;
        UserService.find_users('').then(function (result) {
            $scope.assignUsersData.allUsers = result || [];
            $scope.assignUsersData.loadingUsers = false;
        }, function (reason) {
            toastr.error(AppUtil.errorMsg(reason), '加载用户列表失败');
            $scope.assignUsersData.loadingUsers = false;
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
                loadTemplates();

                // 如果已分配用户模态框已打开，刷新数据
                if ($scope.assignedUsersData && $scope.assignedUsersData.templateName === $scope.assignUsersData.templateName) {
                    loadAssignedUsers($scope.assignUsersData.templateName);
                }
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '分配用户失败');
            });
    };

    $scope.cancelAssignUsers = function () {
        $('#assignUsersModal').modal('hide');
    };

    // 监听搜索用户输入，更新全选状态
    $scope.$watch('assignUsersData.searchUserKey', function () {
        if ($scope.assignUsersData) {
            updateSelectAllStatus();
        }
    });

    // ==================== 已分配用户管理 ====================

    $scope.showAssignedUsersModal = function (templateName) {
        $scope.assignedUsersData = {
            templateName: templateName,
            users: [],
            searchKey: '',
            loading: false
        };

        loadAssignedUsers(templateName);
        $('#assignedUsersModal').modal('show');
    };

    function loadAssignedUsers(templateName) {
        $scope.assignedUsersData.loading = true;
        RoleTemplateService.get_template_users(templateName)
            .then(function (result) {
                $scope.assignedUsersData.users = result || [];
                $scope.assignedUsersData.loading = false;
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '加载用户列表失败');
                $scope.assignedUsersData.loading = false;
            });
    }

    $scope.removeUserFromTemplateInModal = function (userId) {
        if (!confirm('确认将用户 "' + userId + '" 从角色模板中移除吗？')) {
            return;
        }

        RoleTemplateService.remove_users_from_template($scope.assignedUsersData.templateName, [userId])
            .then(function () {
                toastr.success('移除用户成功');
                loadAssignedUsers($scope.assignedUsersData.templateName);
                loadTemplates();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '移除用户失败');
            });
    };

    // ==================== 编辑模板信息 ====================

    $scope.showEditTemplateModal = function () {
        $scope.editTemplateData = {
            templateName: $scope.templateDetail.template.templateName,
            description: $scope.templateDetail.template.description || ''
        };

        $('#editTemplateModal').modal('show');
    };

    $scope.confirmEditTemplate = function () {
        // TODO: 调用后端API更新模板信息
        // 暂时只在前端更新
        $scope.templateDetail.template.description = $scope.editTemplateData.description;

        var template = $scope.templates.find(function (t) {
            return t.templateName === $scope.editTemplateData.templateName;
        });
        if (template) {
            template.description = $scope.editTemplateData.description;
        }

        toastr.success('更新成功');
        $('#editTemplateModal').modal('hide');
    };

    // ==================== 复制模板 ====================

    $scope.copyTemplate = function (templateName) {
        var newTemplateName = prompt('请输入新模板名称', templateName + '_copy');

        if (!newTemplateName || !newTemplateName.trim()) {
            return;
        }

        newTemplateName = newTemplateName.trim();

        if (newTemplateName === templateName) {
            toastr.warning('新模板名称不能与原模板名称相同');
            return;
        }

        RoleTemplateService.copy_template(templateName, newTemplateName)
            .then(function (result) {
                toastr.success('复制成功');
                $('#templateDetailModal').modal('hide');
                loadTemplates();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '复制失败');
            });
    };

    // ==================== 删除模板 ====================

    $scope.deleteTemplate = function (templateName) {
        var template = $scope.templates.find(function (t) {
            return t.templateName === templateName;
        });

        var confirmMsg = '确认删除角色模板 "' + templateName + '" 吗？';
        if (template && template.userCount > 0) {
            confirmMsg = '角色模板 "' + templateName + '" 还有 ' + template.userCount + ' 个用户正在使用，删除后这些用户将失去该模板下的所有权限。\n\n确认删除吗？';
        }

        if (!confirm(confirmMsg)) {
            return;
        }

        RoleTemplateService.delete_template(templateName)
            .then(function () {
                toastr.success('删除成功');
                $('#templateDetailModal').modal('hide');
                loadTemplates();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '删除失败');
            });
    };

    // ==================== 🆕 批量分配功能 ====================

    $scope.showBatchAssignModal = function () {
        $scope.batchAssignData = {
            selectedTemplates: [],
            selectedUsers: [],
            allUsers: [],
            searchUserKey: '',
            loadingUsers: false,
            selectAll: false,
            currentStep: 1
        };

        loadAllUsersForBatch();
        $('#batchAssignModal').modal('show');
    };

    function loadAllUsersForBatch() {
        $scope.batchAssignData.loadingUsers = true;
        UserService.find_users('').then(function (result) {
            $scope.batchAssignData.allUsers = result || [];
            $scope.batchAssignData.loadingUsers = false;
        }, function (reason) {
            toastr.error(AppUtil.errorMsg(reason), '加载用户列表失败');
            $scope.batchAssignData.loadingUsers = false;
        });
    }

    $scope.toggleTemplateSelection = function (template) {
        var index = $scope.batchAssignData.selectedTemplates.findIndex(function (t) {
            return t.templateName === template.templateName;
        });

        if (index > -1) {
            $scope.batchAssignData.selectedTemplates.splice(index, 1);
        } else {
            $scope.batchAssignData.selectedTemplates.push(template);
        }
    };

    $scope.isTemplateSelected = function (template) {
        return $scope.batchAssignData.selectedTemplates.some(function (t) {
            return t.templateName === template.templateName;
        });
    };

    $scope.nextStepToUsers = function () {
        if ($scope.batchAssignData.selectedTemplates.length === 0) {
            toastr.warning('请至少选择一个角色模板');
            return;
        }
        $scope.batchAssignData.currentStep = 2;
    };

    $scope.previousStepToTemplates = function () {
        $scope.batchAssignData.currentStep = 1;
    };

    $scope.searchUsersForBatch = function () {
        if (!$scope.batchAssignData || !$scope.batchAssignData.allUsers) {
            return [];
        }
        if (!$scope.batchAssignData.searchUserKey) {
            return $scope.batchAssignData.allUsers;
        }
        var keyword = $scope.batchAssignData.searchUserKey.toLowerCase();
        return $scope.batchAssignData.allUsers.filter(function (user) {
            return user.userId.toLowerCase().indexOf(keyword) !== -1 ||
                (user.name && user.name.toLowerCase().indexOf(keyword) !== -1) ||
                (user.email && user.email.toLowerCase().indexOf(keyword) !== -1);
        });
    };

    $scope.toggleUserSelectionForBatch = function (user) {
        var index = $scope.batchAssignData.selectedUsers.findIndex(function (u) {
            return u.userId === user.userId;
        });

        if (index > -1) {
            $scope.batchAssignData.selectedUsers.splice(index, 1);
        } else {
            $scope.batchAssignData.selectedUsers.push(user);
        }

        updateSelectAllStatusForBatch();
    };

    $scope.isUserSelectedForBatch = function (user) {
        return $scope.batchAssignData.selectedUsers.some(function (u) {
            return u.userId === user.userId;
        });
    };

    $scope.toggleSelectAllForBatch = function () {
        var filteredUsers = $scope.searchUsersForBatch();

        if ($scope.batchAssignData.selectAll) {
            filteredUsers.forEach(function (user) {
                var index = $scope.batchAssignData.selectedUsers.findIndex(function (u) {
                    return u.userId === user.userId;
                });
                if (index > -1) {
                    $scope.batchAssignData.selectedUsers.splice(index, 1);
                }
            });
            $scope.batchAssignData.selectAll = false;
        } else {
            filteredUsers.forEach(function (user) {
                var index = $scope.batchAssignData.selectedUsers.findIndex(function (u) {
                    return u.userId === user.userId;
                });
                if (index === -1) {
                    $scope.batchAssignData.selectedUsers.push(user);
                }
            });
            $scope.batchAssignData.selectAll = true;
        }
    };

    function updateSelectAllStatusForBatch() {
        var filteredUsers = $scope.searchUsersForBatch();
        if (filteredUsers.length === 0) {
            $scope.batchAssignData.selectAll = false;
            return;
        }

        var allSelected = filteredUsers.every(function (user) {
            return $scope.isUserSelectedForBatch(user);
        });

        $scope.batchAssignData.selectAll = allSelected;
    }

    $scope.confirmBatchAssign = function () {
        if ($scope.batchAssignData.selectedTemplates.length === 0) {
            toastr.warning('请至少选择一个角色模板');
            return;
        }

        if ($scope.batchAssignData.selectedUsers.length === 0) {
            toastr.warning('请至少选择一个用户');
            return;
        }

        var templateNames = $scope.batchAssignData.selectedTemplates.map(function (t) {
            return t.templateName;
        });

        var userIds = $scope.batchAssignData.selectedUsers.map(function (u) {
            return u.userId;
        });

        RoleTemplateService.batch_assign_templates(templateNames, userIds)
            .then(function (result) {
                toastr.success('批量分配成功');
                $('#batchAssignModal').modal('hide');
                loadTemplates();
            }, function (reason) {
                toastr.error(AppUtil.errorMsg(reason), '批量分配失败');
            });
    };

    $scope.cancelBatchAssign = function () {
        $('#batchAssignModal').modal('hide');
    };

    // 监听批量分配搜索用户输入
    $scope.$watch('batchAssignData.searchUserKey', function () {
        if ($scope.batchAssignData) {
            updateSelectAllStatusForBatch();
        }
    });
}
