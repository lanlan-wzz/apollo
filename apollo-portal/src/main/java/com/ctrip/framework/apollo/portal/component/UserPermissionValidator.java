/*
 * Copyright 2024 Apollo Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
package com.ctrip.framework.apollo.portal.component;

import com.ctrip.framework.apollo.common.entity.AppNamespace;
import com.ctrip.framework.apollo.portal.component.config.PortalConfig;
import com.ctrip.framework.apollo.portal.constant.PermissionType;
import com.ctrip.framework.apollo.portal.service.AppNamespaceService;
import com.ctrip.framework.apollo.portal.service.RolePermissionService;
import com.ctrip.framework.apollo.portal.service.RoleTemplateService;
import com.ctrip.framework.apollo.portal.service.SystemRoleManagerService;
import com.ctrip.framework.apollo.portal.spi.UserInfoHolder;
import com.ctrip.framework.apollo.portal.util.RoleUtils;
import org.springframework.stereotype.Component;

@Component("userPermissionValidator")
public class UserPermissionValidator implements PermissionValidator {

  private final UserInfoHolder userInfoHolder;
  private final RolePermissionService rolePermissionService;
  private final RoleTemplateService roleTemplateService;  // 🆕 新增
  private final PortalConfig portalConfig;
  private final AppNamespaceService appNamespaceService;
  private final SystemRoleManagerService systemRoleManagerService;

  public UserPermissionValidator(
          final UserInfoHolder userInfoHolder,
          final RolePermissionService rolePermissionService,
          final RoleTemplateService roleTemplateService,  // 🆕 新增注入
          final PortalConfig portalConfig,
          final AppNamespaceService appNamespaceService,
          final SystemRoleManagerService systemRoleManagerService) {
    this.userInfoHolder = userInfoHolder;
    this.rolePermissionService = rolePermissionService;
    this.roleTemplateService = roleTemplateService;  // 🆕 新增
    this.portalConfig = portalConfig;
    this.appNamespaceService = appNamespaceService;
    this.systemRoleManagerService = systemRoleManagerService;
  }

  // 🔧 修改：扩展权限检查，支持角色模板
  /**
   * 检查用户是否有某个权限（支持直接授权和角色模板授权）
   */
  private boolean userHasPermission(String userId, String permissionType, String targetId) {
    // 1. 检查直接授权的权限（原有逻辑）
    boolean hasDirectPermission = rolePermissionService.userHasPermission(
            userId, permissionType, targetId
    );

    if (hasDirectPermission) {
      return true;
    }

    // 2. 🆕 检查通过角色模板获得的权限
    return roleTemplateService.userHasPermissionByTemplate(
            userId, permissionType, targetId
    );
  }

  // 🔧 修改：使用新的权限检查方法
  private boolean hasModifyNamespacePermission(String appId, String namespaceName) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.MODIFY_NAMESPACE,
            RoleUtils.buildNamespaceTargetId(appId, namespaceName)
    );
  }

  // 🔧 修改：使用新的权限检查方法
  private boolean hasModifyNamespacePermission(String appId, String namespaceName, String env) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.MODIFY_NAMESPACE,
            RoleUtils.buildNamespaceTargetId(appId, namespaceName, env)
    );
  }

  // 🔧 修改：使用新的权限检查方法
  private boolean hasModifyNamespacesInClusterPermission(String appId, String env, String clusterName) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.MODIFY_NAMESPACES_IN_CLUSTER,
            RoleUtils.buildClusterTargetId(appId, env, clusterName)
    );
  }

  @Override
  public boolean hasModifyNamespacePermission(String appId, String env, String clusterName, String namespaceName) {
    if (hasModifyNamespacePermission(appId, namespaceName)) {
      return true;
    }
    if (hasModifyNamespacePermission(appId, namespaceName, env)) {
      return true;
    }
    if (hasModifyNamespacesInClusterPermission(appId, env, clusterName)) {
      return true;
    }
    return false;
  }

  // 🔧 修改：使用新的权限检查方法
  private boolean hasReleaseNamespacePermission(String appId, String namespaceName) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.RELEASE_NAMESPACE,
            RoleUtils.buildNamespaceTargetId(appId, namespaceName)
    );
  }

  // 🔧 修改：使用新的权限检查方法
  private boolean hasReleaseNamespacePermission(String appId, String namespaceName, String env) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.RELEASE_NAMESPACE,
            RoleUtils.buildNamespaceTargetId(appId, namespaceName, env)
    );
  }

  // 🔧 修改：使用新的权限检查方法
  private boolean hasReleaseNamespacesInClusterPermission(String appId, String env, String clusterName) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.RELEASE_NAMESPACES_IN_CLUSTER,
            RoleUtils.buildClusterTargetId(appId, env, clusterName)
    );
  }

  @Override
  public boolean hasReleaseNamespacePermission(String appId, String env, String clusterName, String namespaceName) {
    if (hasReleaseNamespacePermission(appId, namespaceName)) {
      return true;
    }
    if (hasReleaseNamespacePermission(appId, namespaceName, env)) {
      return true;
    }
    if (hasReleaseNamespacesInClusterPermission(appId, env, clusterName)) {
      return true;
    }
    return false;
  }

  // 🔧 修改：使用新的权限检查方法
  @Override
  public boolean hasAssignRolePermission(String appId) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.ASSIGN_ROLE,
            appId
    );
  }

  // 🔧 修改：使用新的权限检查方法
  @Override
  public boolean hasCreateNamespacePermission(String appId) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.CREATE_NAMESPACE,
            appId
    );
  }

  @Override
  public boolean hasCreateAppNamespacePermission(String appId, AppNamespace appNamespace) {

    boolean isPublicAppNamespace = appNamespace.isPublic();

    if (portalConfig.canAppAdminCreatePrivateNamespace() || isPublicAppNamespace) {
      return hasCreateNamespacePermission(appId);
    }

    return isSuperAdmin();
  }

  // 🔧 修改：使用新的权限检查方法
  @Override
  public boolean hasCreateClusterPermission(String appId) {
    return userHasPermission(
            userInfoHolder.getUser().getUserId(),
            PermissionType.CREATE_CLUSTER,
            appId
    );
  }

  @Override
  public boolean isSuperAdmin() {
    return rolePermissionService.isSuperAdmin(userInfoHolder.getUser().getUserId());
  }

  @Override
  public boolean shouldHideConfigToCurrentUser(String appId, String env, String clusterName,
                                               String namespaceName) {
    // 1. check whether the current environment enables member only function
    if (!portalConfig.isConfigViewMemberOnly(env)) {
      return false;
    }

    // 2. public namespace is open to every one
    AppNamespace appNamespace = appNamespaceService.findByAppIdAndName(appId, namespaceName);
    if (appNamespace != null && appNamespace.isPublic()) {
      return false;
    }

    // 3. check app admin and operate permissions
    return !isAppAdmin(appId) && !hasOperateNamespacePermission(appId, env, clusterName, namespaceName);
  }

  @Override
  public boolean hasCreateApplicationPermission() {
    return hasCreateApplicationPermission(userInfoHolder.getUser().getUserId());
  }

  public boolean hasCreateApplicationPermission(String userId) {
    return systemRoleManagerService.hasCreateApplicationPermission(userId);
  }

  @Override
  public boolean hasManageAppMasterPermission(String appId) {
    // the manage app master permission might not be initialized, so we need to check isSuperAdmin first
    return isSuperAdmin() ||
            (hasAssignRolePermission(appId) &&
                    systemRoleManagerService.hasManageAppMasterPermission(userInfoHolder.getUser().getUserId(), appId)
            );
  }

  // 🆕 新增方法：检查是否为应用管理员
  public boolean isAppAdmin(String appId) {
    return isSuperAdmin() || hasAssignRolePermission(appId);
  }

  // 🆕 新增方法：检查是否有操作命名空间的权限
  public boolean hasOperateNamespacePermission(String appId, String env, String clusterName, String namespaceName) {
    return hasModifyNamespacePermission(appId, env, clusterName, namespaceName)
            || hasReleaseNamespacePermission(appId, env, clusterName, namespaceName);
  }

  // 🆕 新增方法：检查是否有删除命名空间的权限
  public boolean hasDeleteNamespacePermission(String appId) {
    return hasAssignRolePermission(appId) || isSuperAdmin();
  }
}
