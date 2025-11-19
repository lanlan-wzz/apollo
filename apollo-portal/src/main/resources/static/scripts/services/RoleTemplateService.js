/*
 * Copyright 2024 Apollo Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
appService.service('RoleTemplateService', ['$resource', '$q', 'AppUtil', function ($resource, $q, AppUtil) {
    var role_template_resource = $resource('', {}, {
        // 创建角色模板
        create_template: {
            method: 'POST',
            url: AppUtil.prefixPath() + '/role-templates'
        },
        // 查询所有角色模板
        list_all_templates: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/role-templates',
            isArray: true
        },
        // 查询角色模板详情
        get_template_detail: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/role-templates/:templateName'
        },
        // 删除角色模板
        delete_template: {
            method: 'DELETE',
            url: AppUtil.prefixPath() + '/role-templates/:templateName'
        },
        // 添加应用到角色模板
        add_apps_to_template: {
            method: 'POST',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/apps'
        },
        // 从角色模板移除应用
        remove_app_from_template: {
            method: 'DELETE',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/apps/:appId'
        },
        // 查询角色模板的应用列表
        get_template_apps: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/apps',
            isArray: true
        },
        // 🔧 修改：查询角色模板的权限详情（旧版本，兼容）
        get_template_permissions: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/permissions',
            isArray: true
        },
        // 🆕 新增：查询角色模板权限汇总（结构化格式）
        get_template_permission_summary: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/permission-summary'
        },
        // 权限矩阵
        get_permission_matrix: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/permissions/matrix/apps/:appId'
        },
        // 分配用户到角色模板
        assign_users_to_template: {
            method: 'POST',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/users'
        },
        // 从角色模板移除用户
        remove_users_from_template: {
            method: 'DELETE',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/users'
        },
        // 查询角色模板的用户列表
        get_template_users: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/users',
            isArray: true
        },
        // 查询用户的角色模板
        get_user_templates: {
            method: 'GET',
            url: AppUtil.prefixPath() + '/role-templates/users/:userId',
            isArray: true
        },
        // 复制角色模板
        copy_template: {
            method: 'POST',
            url: AppUtil.prefixPath() + '/role-templates/:templateName/copy'
        },
        // 🆕 新增：批量分配角色模板
        batch_assign_templates: {
            method: 'POST',
            url: AppUtil.prefixPath() + '/role-templates/batch-assign'
        }

    });

    return {
        create_template: function (templateName, description) {
            var d = $q.defer();
            role_template_resource.create_template({}, {
                templateName: templateName,
                description: description
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        list_all_templates: function () {
            var d = $q.defer();
            role_template_resource.list_all_templates({}, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        get_template_detail: function (templateName) {
            var d = $q.defer();
            role_template_resource.get_template_detail({
                templateName: templateName
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        delete_template: function (templateName) {
            var d = $q.defer();
            role_template_resource.delete_template({
                templateName: templateName
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        add_apps_to_template: function (templateName, apps) {
            var d = $q.defer();
            role_template_resource.add_apps_to_template({
                templateName: templateName
            }, {
                apps: apps
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        remove_app_from_template: function (templateName, appId) {
            var d = $q.defer();
            role_template_resource.remove_app_from_template({
                templateName: templateName,
                appId: appId
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        get_template_apps: function (templateName) {
            var d = $q.defer();
            role_template_resource.get_template_apps({
                templateName: templateName
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        // 🔧 保留旧版本方法（兼容性）
        get_template_permissions: function (templateName) {
            var d = $q.defer();
            role_template_resource.get_template_permissions({
                templateName: templateName
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        // 🆕 新增：获取结构化权限汇总
        get_template_permission_summary: function (templateName) {
            var d = $q.defer();
            role_template_resource.get_template_permission_summary({
                templateName: templateName
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        get_permission_matrix: function (appId) {
            var d = $q.defer();
            role_template_resource.get_permission_matrix({
                appId: appId
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        assign_users_to_template: function (templateName, userIds) {
            var d = $q.defer();
            role_template_resource.assign_users_to_template({
                templateName: templateName
            }, {
                userIds: userIds
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        remove_users_from_template: function (templateName, userIds) {
            var d = $q.defer();
            role_template_resource.remove_users_from_template({
                templateName: templateName
            }, {
                userIds: userIds
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        get_template_users: function (templateName) {
            var d = $q.defer();
            role_template_resource.get_template_users({
                templateName: templateName
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        get_user_templates: function (userId) {
            var d = $q.defer();
            role_template_resource.get_user_templates({
                userId: userId
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        copy_template: function (sourceTemplateName, newTemplateName) {
            var d = $q.defer();
            role_template_resource.copy_template({
                templateName: sourceTemplateName,
                newTemplateName: newTemplateName
            }, null, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },

        // 🆕 新增：批量分配角色模板
        batch_assign_templates: function (templateNames, userIds) {
            var d = $q.defer();
            role_template_resource.batch_assign_templates({}, {
                templateNames: templateNames,
                userIds: userIds
            }, function (result) {
                d.resolve(result);
            }, function (result) {
                d.reject(result);
            });
            return d.promise;
        },
        // 在 RoleTemplateService.js 中添加以下方法

        // 移除系统权限
        remove_system_permission: function (templateName, permissionType) {
            return $http.delete('/role-templates/' + templateName + '/system-permissions/' + permissionType);
        },

        // 移除应用权限
        remove_app_permission: function (templateName, appId, permissionType) {
            return $http.delete('/role-templates/' + templateName + '/apps/' + appId + '/permissions/' + permissionType);
        },

        // 移除命名空间权限
        remove_namespace_permission: function (templateName, appId, namespaceName, env) {
            var url = '/role-templates/' + templateName + '/apps/' + appId + '/namespaces/' + namespaceName + '/permissions';
            if (env) {
                url += '?env=' + env;
            }
            return $http.delete(url);
        },

        // 移除集群权限
        remove_cluster_permission: function (templateName, appId, clusterName, env) {
            var url = '/role-templates/' + templateName + '/apps/' + appId + '/clusters/' + clusterName + '/permissions';
            if (env) {
                url += '?env=' + env;
            }
            return $http.delete(url);
        }
    };
}]);
