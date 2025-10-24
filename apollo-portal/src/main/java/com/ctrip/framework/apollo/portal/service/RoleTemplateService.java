package com.ctrip.framework.apollo.portal.service;

import com.ctrip.framework.apollo.common.exception.BadRequestException;
import com.ctrip.framework.apollo.portal.component.config.PortalConfig;
import com.ctrip.framework.apollo.portal.constant.PermissionType;
import com.ctrip.framework.apollo.portal.entity.bo.*;
import com.ctrip.framework.apollo.portal.entity.po.Permission;
import com.ctrip.framework.apollo.portal.entity.po.Role;
import com.ctrip.framework.apollo.portal.entity.po.RolePermission;
import com.ctrip.framework.apollo.portal.entity.po.UserRole;
import com.ctrip.framework.apollo.portal.entity.vo.AppPermissionConfig;
import com.ctrip.framework.apollo.portal.entity.vo.BatchOperationResult;
import com.ctrip.framework.apollo.portal.environment.Env;
import com.ctrip.framework.apollo.portal.repository.PermissionRepository;
import com.ctrip.framework.apollo.portal.repository.RolePermissionRepository;
import com.ctrip.framework.apollo.portal.repository.RoleRepository;
import com.ctrip.framework.apollo.portal.repository.UserRoleRepository;
import com.ctrip.framework.apollo.portal.spi.UserService;
import com.ctrip.framework.apollo.portal.util.RoleUtils;
import com.google.common.collect.Sets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 角色模板服务
 * 实现批量权限管理功能
 */
@Service
public class RoleTemplateService {

    private static final Logger logger = LoggerFactory.getLogger(RoleTemplateService.class);
    private static final String ROLE_TEMPLATE_PREFIX = "RoleTemplate+";

    private final RoleRepository roleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionRepository permissionRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserService userService;
    private final RoleInitializationService roleInitializationService;
    private final RolePermissionService rolePermissionService;
    private final PortalConfig portalConfig;

    public RoleTemplateService(
            final RoleRepository roleRepository,
            final RolePermissionRepository rolePermissionRepository,
            final PermissionRepository permissionRepository,
            final UserRoleRepository userRoleRepository,
            final UserService userService,
            final RoleInitializationService roleInitializationService,
            final RolePermissionService rolePermissionService,
            final PortalConfig portalConfig) {
        this.roleRepository = roleRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.permissionRepository = permissionRepository;
        this.userRoleRepository = userRoleRepository;
        this.userService = userService;
        this.roleInitializationService = roleInitializationService;
        this.rolePermissionService = rolePermissionService;
        this.portalConfig = portalConfig;
    }

    /**
     * 创建角色模板
     */
    @Transactional
    public Role createRoleTemplate(String templateName, String description, String operator) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;

        // 检查是否已存在
        Role existingRole = roleRepository.findTopByRoleName(roleName);
        if (existingRole != null && !existingRole.isDeleted()) {
            throw new BadRequestException("角色模板已存在: " + templateName);
        }

        Role role = new Role();
        role.setRoleName(roleName);
        role.setDataChangeCreatedBy(operator);
        role.setDataChangeLastModifiedBy(operator);

        Role savedRole = roleRepository.save(role);
        logger.info("Created role template: {}, operator: {}", templateName, operator);

        return savedRole;
    }

    /**
     * 批量添加应用权限到角色模板
     */
    @Transactional
    public BatchOperationResult addAppsToTemplate(String templateName,
                                                  List<AppPermissionConfig> apps,
                                                  String operator) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            throw new BadRequestException("角色模板不存在: " + templateName);
        }

        List<String> successList = new ArrayList<>();
        List<String> failedList = new ArrayList<>();

        for (AppPermissionConfig config : apps) {
            try {
                addAppPermissionsToRole(role, config, operator);
                successList.add(config.getAppId());
                logger.info("Added app {} to template {}", config.getAppId(), templateName);
            } catch (Exception e) {
                String errorMsg = config.getAppId() + ": " + e.getMessage();
                failedList.add(errorMsg);
                logger.error("Failed to add app {} to template {}: {}",
                        config.getAppId(), templateName, e.getMessage());
            }
        }

        return new BatchOperationResult(successList, failedList);
    }

    /**
     * 为角色添加单个应用的权限
     * 🔧 重构：使用 RoleInitializationService 确保权限和角色的正确创建
     */
    private void addAppPermissionsToRole(Role role, AppPermissionConfig config, String operator) {
        if (CollectionUtils.isEmpty(config.getPermissionTypes())) {
            throw new BadRequestException("权限类型列表不能为空");
        }

        String appId = config.getAppId();
        String namespaceName = config.getNamespaceName();
        String env = config.getEnv();
        String clusterName = config.getClusterName();

        // 🆕 处理系统级权限
        if (isSystemPermissionConfig(config)) {
            addSystemPermissionsToRole(role, config.getPermissionTypes(), operator);
            return;
        }

        // 确保应用不为空
        if (appId == null || appId.isEmpty()) {
            throw new BadRequestException("应用ID不能为空");
        }

        for (String permissionType : config.getPermissionTypes()) {
            try {
                // 🔧 根据权限类型和配置，确保相应的角色和权限已创建
                ensurePermissionExists(appId, namespaceName, env, clusterName, permissionType, operator);

                // 🔧 查找权限并关联到角色模板
                Permission permission = findPermission(appId, namespaceName, env, clusterName, permissionType);

                if (permission == null) {
                    throw new BadRequestException(
                            "权限不存在: " + permissionType + " - " +
                                    buildTargetId(appId, namespaceName, env, clusterName, permissionType)
                    );
                }

                // 关联权限到角色模板
                associatePermissionToRole(role, permission, operator);

            } catch (Exception e) {
                logger.error("Failed to add permission {} for app {}: {}",
                        permissionType, appId, e.getMessage());
                throw new BadRequestException("添加权限失败: " + permissionType + " - " + e.getMessage());
            }
        }
    }

    /**
     * 🆕 判断是否为系统权限配置
     */
    private boolean isSystemPermissionConfig(AppPermissionConfig config) {
        return config.getAppId() == null || config.getAppId().isEmpty() ||
                "SystemRole".equals(config.getAppId());
    }

    /**
     * 🆕 添加系统权限到角色模板
     */
    private void addSystemPermissionsToRole(Role role, List<String> permissionTypes, String operator) {
        for (String permissionType : permissionTypes) {
            if (PermissionType.CREATE_APPLICATION.equals(permissionType)) {
                // 🔧 确保创建应用权限存在
                roleInitializationService.initCreateAppRole();

                // 查找创建应用权限
                Permission permission = permissionRepository.findTopByPermissionTypeAndTargetId(
                        PermissionType.CREATE_APPLICATION, "SystemRole");

                if (permission != null) {
                    associatePermissionToRole(role, permission, operator);
                }
            }
        }
    }

    /**
     * 🔧 确保权限存在（使用 RoleInitializationService）
     */
    private void ensurePermissionExists(String appId, String namespaceName, String env,
                                        String clusterName, String permissionType, String operator) {

        // 🔧 应用级权限：CreateCluster, CreateNamespace, AssignRole, ManageAppMaster
        if (isAppLevelPermission(permissionType)) {
            // Apollo 在创建应用时会自动创建这些权限，这里不需要额外处理
            // 如果权限不存在，说明应用可能还未创建
            return;
        }

        // 🔧 命名空间级权限：ModifyNamespace, ReleaseNamespace
        if (isNamespacePermission(permissionType)) {
            if (namespaceName == null || namespaceName.isEmpty()) {
                throw new BadRequestException("命名空间级权限需要指定命名空间名称");
            }

            if (env != null && !env.isEmpty()) {
                // 🚀 环境级命名空间权限
                roleInitializationService.initNamespaceSpecificEnvRoles(appId, namespaceName, env, operator);
            } else {
                // 🚀 通用命名空间权限
                roleInitializationService.initNamespaceRoles(appId, namespaceName, operator);
            }
            return;
        }

        // 🔧 集群级权限：ModifyNamespacesInCluster, ReleaseNamespacesInCluster
        if (isClusterPermission(permissionType)) {
            if (env == null || env.isEmpty()) {
                throw new BadRequestException("集群级权限需要指定环境");
            }
            if (clusterName == null || clusterName.isEmpty()) {
                throw new BadRequestException("集群级权限需要指定集群名称");
            }

            // 🚀 集群权限
            roleInitializationService.initClusterNamespaceRoles(appId, env, clusterName, operator);
            return;
        }

        throw new BadRequestException("不支持的权限类型: " + permissionType);
    }

    /**
     * 🔧 查找权限
     */
    private Permission findPermission(String appId, String namespaceName, String env,
                                      String clusterName, String permissionType) {
        String targetId = buildTargetId(appId, namespaceName, env, clusterName, permissionType);
        return permissionRepository.findTopByPermissionTypeAndTargetId(permissionType, targetId);
    }

    /**
     * 🔧 构建 targetId（根据权限类型）
     */
    private String buildTargetId(String appId, String namespaceName, String env,
                                 String clusterName, String permissionType) {

        // 应用级权限：targetId = appId
        if (isAppLevelPermission(permissionType)) {
            return appId;
        }

        // 命名空间级权限
        if (isNamespacePermission(permissionType)) {
            if (env != null && !env.isEmpty()) {
                // targetId = appId+namespaceName+env
                return RoleUtils.buildNamespaceTargetId(appId, namespaceName, env);
            } else {
                // targetId = appId+namespaceName
                return RoleUtils.buildNamespaceTargetId(appId, namespaceName);
            }
        }

        // 集群级权限：targetId = appId+clusterName+env
        if (isClusterPermission(permissionType)) {
            return RoleUtils.buildClusterTargetId(appId, env, clusterName);
        }

        // 默认情况
        return appId;
    }

    /**
     * 🔧 关联权限到角色模板
     */
    private void associatePermissionToRole(Role role, Permission permission, String operator) {
        // 检查是否已关联
        RolePermission existing = rolePermissionRepository
                .findByRoleIdAndPermissionId(role.getId(), permission.getId());

        if (existing != null && !existing.isDeleted()) {
            logger.debug("Permission already exists: roleId={}, permissionId={}",
                    role.getId(), permission.getId());
            return;
        }

        // 如果之前删除过，恢复
        if (existing != null && existing.isDeleted()) {
            existing.setDeleted(false);
            existing.setDataChangeLastModifiedBy(operator);
            rolePermissionRepository.save(existing);
        } else {
            // 创建新关联
            RolePermission rp = new RolePermission();
            rp.setRoleId(role.getId());
            rp.setPermissionId(permission.getId());
            rp.setDataChangeCreatedBy(operator);
            rp.setDataChangeLastModifiedBy(operator);
            rolePermissionRepository.save(rp);
        }
    }

    /**
     * 从角色模板移除应用
     */
    @Transactional
    public void removeAppFromTemplate(String templateName, String appId, String operator) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            throw new BadRequestException("角色模板不存在: " + templateName);
        }

        // 查询该角色的所有权限关联
        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(role.getId()));
        int removedCount = 0;
        for (RolePermission rp : rolePermissions) {
            if (rp.isDeleted()) {
                continue;
            }

            Permission permission = permissionRepository
                    .findById(rp.getPermissionId()).orElse(null);

            // 如果权限的 targetId 以该 appId 开头，则删除关联
            if (permission != null && !permission.isDeleted() &&
                    (permission.getTargetId().startsWith(appId + "+") ||
                            permission.getTargetId().equals(appId))) {

                rp.setDeleted(true);
                rp.setDataChangeLastModifiedBy(operator);
                rolePermissionRepository.save(rp);
                removedCount++;
            }
        }

        logger.info("Removed {} permissions for app {} from template {}",
                removedCount, appId, templateName);
    }

    /**
     * 给用户批量分配角色模板
     */
    @Transactional
    public BatchOperationResult assignTemplateToUsers(String templateName,
                                                      List<String> userIds,
                                                      String operator) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            throw new BadRequestException("角色模板不存在: " + templateName);
        }

        List<String> successList = new ArrayList<>();
        List<String> failedList = new ArrayList<>();


        for (String userId : userIds) {
            try {
                // 检查用户是否存在
                if (userService.findByUserId(userId) == null) {
                    throw new BadRequestException("用户不存在: " + userId);
                }

                // 检查是否已分配
                UserRole existing = userRoleRepository
                        .findByUserIdAndRoleId(userId, role.getId());

                if (existing != null && !existing.isDeleted()) {
                    logger.debug("User {} already has template {}", userId, templateName);
                    successList.add(userId + " (已存在)");
                    continue;
                }

                // 如果之前删除过，恢复
                if (existing != null && existing.isDeleted()) {
                    existing.setDeleted(false);
                    existing.setDataChangeLastModifiedBy(operator);
                    userRoleRepository.save(existing);
                } else {
                    // 创建新关联
                    UserRole userRole = new UserRole();
                    userRole.setUserId(userId);
                    userRole.setRoleId(role.getId());
                    userRole.setDataChangeCreatedBy(operator);
                    userRole.setDataChangeLastModifiedBy(operator);
                    userRoleRepository.save(userRole);
                }

                successList.add(userId);
                logger.info("Assigned template {} to user {}", templateName, userId);

            } catch (Exception e) {
                String errorMsg = userId + ": " + e.getMessage();
                failedList.add(errorMsg);
                logger.error("Failed to assign template {} to user {}: {}",
                        templateName, userId, e.getMessage());
            }
        }

        return new BatchOperationResult(successList, failedList);
    }

    /**
     * 从用户移除角色模板
     */
    @Transactional
    public BatchOperationResult removeTemplateFromUsers(String templateName,
                                                        List<String> userIds,
                                                        String operator) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            throw new BadRequestException("角色模板不存在: " + templateName);
        }

        List<String> successList = new ArrayList<>();
        List<String> failedList = new ArrayList<>();

        for (String userId : userIds) {
            try {
                UserRole userRole = userRoleRepository
                        .findByUserIdAndRoleId(userId, role.getId());

                if (userRole == null || userRole.isDeleted()) {
                    logger.debug("User {} does not have template {}", userId, templateName);
                    successList.add(userId + " (未分配)");
                    continue;
                }

                userRole.setDeleted(true);
                userRole.setDataChangeLastModifiedBy(operator);
                userRoleRepository.save(userRole);

                successList.add(userId);
                logger.info("Removed template {} from user {}", templateName, userId);

            } catch (Exception e) {
                String errorMsg = userId + ": " + e.getMessage();
                failedList.add(errorMsg);
                logger.error("Failed to remove template {} from user {}: {}",
                        templateName, userId, e.getMessage());
            }
        }

        return new BatchOperationResult(successList, failedList);
    }

    /**
     * 查询角色模板包含的应用权限
     */
    public List<AppPermissionInfo> getTemplateApps(String templateName) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            return Collections.emptyList();
        }

        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(role.getId()));

        // 按 appId 分组
        Map<String, AppPermissionInfo> appMap = new HashMap<>();

        for (RolePermission rp : rolePermissions) {
            if (rp.isDeleted()) {
                continue;
            }

            Permission permission = permissionRepository
                    .findById(rp.getPermissionId()).orElse(null);

            if (permission != null && !permission.isDeleted()) {
                String appId = extractAppId(permission.getTargetId());

                AppPermissionInfo info = appMap.computeIfAbsent(appId,
                        k -> new AppPermissionInfo(appId));

                info.addPermission(
                        permission.getPermissionType(),
                        permission.getTargetId()
                );
            }
        }

        return new ArrayList<>(appMap.values());
    }

    /**
     * 查询角色模板的所有权限详情
     */
    public List<TemplatePermissionDetail> getTemplatePermissions(String templateName) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            return Collections.emptyList();
        }

        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(role.getId()));
        List<TemplatePermissionDetail> details = new ArrayList<>();

        for (RolePermission rp : rolePermissions) {
            if (rp.isDeleted()) {
                continue;
            }

            Permission permission = permissionRepository
                    .findById(rp.getPermissionId()).orElse(null);

            if (permission != null && !permission.isDeleted()) {
                TemplatePermissionDetail detail = new TemplatePermissionDetail();
                detail.setPermissionId(permission.getId());
                detail.setPermissionType(permission.getPermissionType());
                detail.setTargetId(permission.getTargetId());

                // 🔧 使用新的解析逻辑
                parseTargetId(permission.getTargetId(), permission.getPermissionType(), detail);

                details.add(detail);
            }
        }

        return details;
    }

    /**
     * 🆕 解析 targetId，正确区分不同的权限类型
     */
    private void parseTargetId(String targetId, String permissionType, TemplatePermissionDetail detail) {
        if (targetId == null || targetId.isEmpty()) {
            return;
        }

        String[] parts = targetId.split("\\+");

        // 设置 appId（第一部分总是 appId，除了系统权限）
        if (!"SystemRole".equals(targetId)) {
            detail.setAppId(parts[0]);
        }

        // 🔍 根据权限类型判断 targetId 格式
        if (isAppLevelPermission(permissionType)) {
            // 🎯 应用级权限：targetId = appId
            detail.setScope("APP");
        } else if (isNamespacePermission(permissionType)) {
            // 🎯 Namespace 级权限：targetId = appId+namespaceName 或 appId+namespaceName+env
            detail.setScope("NAMESPACE");
            if (parts.length >= 2) {
                detail.setNamespaceName(parts[1]);
            }
            if (parts.length >= 3) {
                detail.setEnv(parts[2]);
            }
        } else if (isClusterPermission(permissionType)) {
            // 🎯 集群级权限：targetId = appId+clusterName+env
            detail.setScope("CLUSTER");
            if (parts.length >= 2) {
                detail.setClusterName(parts[1]);  // 🔥 第二部分是集群名
            }
            if (parts.length >= 3) {
                detail.setEnv(parts[2]);          // 🔥 第三部分是环境
            }
        } else if (PermissionType.CREATE_APPLICATION.equals(permissionType)) {
            // 🎯 系统级权限
            detail.setScope("SYSTEM");
        } else {
            // 🤷 未知权限类型，尝试通用解析
            detail.setScope("UNKNOWN");
            if (parts.length >= 2) {
                detail.setNamespaceName(parts[1]);
            }
            if (parts.length >= 3) {
                detail.setEnv(parts[2]);
            }
        }
    }

    /**
     * 查询所有角色模板
     */
    public List<RoleTemplateInfo> listAllTemplates() {
        List<Role> allRoles = (List<Role>) roleRepository.findAll();

        return allRoles.stream()
                .filter(role -> !role.isDeleted())
                .filter(role -> role.getRoleName().startsWith(ROLE_TEMPLATE_PREFIX))
                .map(this::buildRoleTemplateInfo)
                .collect(Collectors.toList());
    }

    /**
     * 查询角色模板详情
     */
    public RoleTemplateInfo getTemplateDetail(String templateName) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            throw new BadRequestException("角色模板不存在: " + templateName);
        }

        return buildRoleTemplateInfo(role);
    }

    /**
     * 删除角色模板
     */
    @Transactional
    public void deleteRoleTemplate(String templateName, String operator) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            throw new BadRequestException("角色模板不存在: " + templateName);
        }

        // 检查是否有用户使用该模板
        List<UserRole> userRoles = userRoleRepository.findByRoleId(role.getId());
        long activeUserCount = userRoles.stream()
                .filter(ur -> !ur.isDeleted())
                .count();

        if (activeUserCount > 0) {
            throw new BadRequestException(
                    "无法删除角色模板，还有 " + activeUserCount + " 个用户正在使用"
            );
        }

        // 软删除角色
        role.setDeleted(true);
        role.setDataChangeLastModifiedBy(operator);
        roleRepository.save(role);

        // 软删除所有权限关联
        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(role.getId()));
        for (RolePermission rp : rolePermissions) {
            if (!rp.isDeleted()) {
                rp.setDeleted(true);
                rp.setDataChangeLastModifiedBy(operator);
                rolePermissionRepository.save(rp);
            }
        }

        logger.info("Deleted role template: {}, operator: {}", templateName, operator);
    }

    /**
     * 查询角色模板下的所有用户
     */
    public List<String> getTemplateUsers(String templateName) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            return Collections.emptyList();
        }

        List<UserRole> userRoles = userRoleRepository.findByRoleId(role.getId());

        return userRoles.stream()
                .filter(ur -> !ur.isDeleted())
                .map(UserRole::getUserId)
                .collect(Collectors.toList());
    }

    /**
     * 查询用户拥有的角色模板
     */
    public List<String> getUserTemplates(String userId) {
        List<UserRole> userRoles = userRoleRepository.findByUserId(userId);

        return userRoles.stream()
                .filter(ur -> !ur.isDeleted())
                .map(ur -> roleRepository.findById(ur.getRoleId()).orElse(null))
                .filter(Objects::nonNull)
                .filter(role -> !role.isDeleted())
                .filter(role -> role.getRoleName().startsWith(ROLE_TEMPLATE_PREFIX))
                .map(role -> role.getRoleName().substring(ROLE_TEMPLATE_PREFIX.length()))
                .collect(Collectors.toList());
    }

    /**
     * 复制角色模板
     */
    @Transactional
    public Role copyRoleTemplate(String sourceTemplateName,
                                 String newTemplateName,
                                 String operator) {
        // 检查源模板
        String sourceRoleName = ROLE_TEMPLATE_PREFIX + sourceTemplateName;
        Role sourceRole = roleRepository.findTopByRoleName(sourceRoleName);

        if (sourceRole == null || sourceRole.isDeleted()) {
            throw new BadRequestException("源角色模板不存在: " + sourceTemplateName);
        }

        // 创建新模板
        Role newRole = createRoleTemplate(newTemplateName,
                "复制自: " + sourceTemplateName, operator);

        // 复制所有权限关联
        List<RolePermission> sourcePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(sourceRole.getId()));

        for (RolePermission sourceRp : sourcePermissions) {
            if (sourceRp.isDeleted()) {
                continue;
            }

            RolePermission newRp = new RolePermission();
            newRp.setRoleId(newRole.getId());
            newRp.setPermissionId(sourceRp.getPermissionId());
            newRp.setDataChangeCreatedBy(operator);
            newRp.setDataChangeLastModifiedBy(operator);

            rolePermissionRepository.save(newRp);
        }

        logger.info("Copied role template from {} to {}, operator: {}",
                sourceTemplateName, newTemplateName, operator);

        return newRole;
    }

    /**
     * 检查用户是否通过角色模板拥有某个权限
     */
    public boolean userHasPermissionByTemplate(String userId,
                                               String permissionType,
                                               String targetId) {
        List<UserRole> userRoles = userRoleRepository.findByUserId(userId);

        for (UserRole userRole : userRoles) {
            if (userRole.isDeleted()) {
                continue;
            }

            Role role = roleRepository.findById(userRole.getRoleId()).orElse(null);

            // 只检查角色模板
            if (role == null || role.isDeleted() ||
                    !role.getRoleName().startsWith(ROLE_TEMPLATE_PREFIX)) {
                continue;
            }

            // 查询角色的所有权限
            List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(role.getId()));

            for (RolePermission rp : rolePermissions) {
                if (rp.isDeleted()) {
                    continue;
                }

                Permission permission = permissionRepository
                        .findById(rp.getPermissionId()).orElse(null);

                if (permission != null && !permission.isDeleted() &&
                        permission.getPermissionType().equals(permissionType) &&
                        permission.getTargetId().equals(targetId)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 构建角色模板信息
     */
    private RoleTemplateInfo buildRoleTemplateInfo(Role role) {
        String templateName = role.getRoleName().substring(ROLE_TEMPLATE_PREFIX.length());

        // 统计用户数
        List<UserRole> userRoles = userRoleRepository.findByRoleId(role.getId());
        int userCount = (int) userRoles.stream()
                .filter(ur -> !ur.isDeleted())
                .count();

        // 统计应用数
        List<AppPermissionInfo> apps = getTemplateApps(templateName);
        int appCount = apps.size();

        // 统计权限数
        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(role.getId()));
        int permissionCount = (int) rolePermissions.stream()
                .filter(rp -> !rp.isDeleted())
                .count();

        RoleTemplateInfo info = new RoleTemplateInfo();
        info.setTemplateName(templateName);
        info.setRoleId(role.getId());
        info.setUserCount(userCount);
        info.setAppCount(appCount);
        info.setPermissionCount(permissionCount);
        info.setCreatedBy(role.getDataChangeCreatedBy());
        info.setCreatedTime(role.getDataChangeCreatedTime());
        info.setLastModifiedBy(role.getDataChangeLastModifiedBy());
        info.setLastModifiedTime(role.getDataChangeLastModifiedTime());

        return info;
    }

    /**
     * 查询角色模板权限汇总（结构化格式）
     */
    public RoleTemplatePermissionSummary getTemplatePermissionSummary(String templateName) {
        String roleName = ROLE_TEMPLATE_PREFIX + templateName;
        Role role = roleRepository.findTopByRoleName(roleName);

        if (role == null || role.isDeleted()) {
            throw new BadRequestException("角色模板不存在: " + templateName);
        }

        RoleTemplatePermissionSummary summary = new RoleTemplatePermissionSummary();
        summary.setTemplateName(templateName);

        // 获取所有权限
        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(Sets.newHashSet(role.getId()));
        List<Permission> permissions = new ArrayList<>();

        for (RolePermission rp : rolePermissions) {
            if (rp.isDeleted()) {
                continue;
            }

            Permission permission = permissionRepository
                    .findById(rp.getPermissionId()).orElse(null);

            if (permission != null && !permission.isDeleted()) {
                permissions.add(permission);
            }
        }

        // 分类处理权限
        summary.setSystemPermissions(extractSystemPermissions(permissions));
        summary.setAppPermissions(extractAppPermissions(permissions));

        return summary;
    }

    /**
     * 🆕 批量初始化应用的所有权限（用于快速添加应用到角色模板）
     */
    @Transactional
    public void initAllAppPermissions(String appId, String operator) {
        try {
            // 🚀 初始化应用的默认命名空间权限
            roleInitializationService.initNamespaceRoles(appId, "application", operator);

            // 🚀 初始化所有环境的命名空间权限
            roleInitializationService.initNamespaceEnvRoles(appId, "application", operator);

            // 🚀 初始化默认集群权限（如果需要）
            List<Env> supportedEnvs = portalConfig.portalSupportedEnvs();
            for (Env env : supportedEnvs) {
                try {
                    roleInitializationService.initClusterNamespaceRoles(appId, env.toString(), "default", operator);
                } catch (Exception e) {
                    logger.warn("Failed to init cluster permissions for app {} env {}: {}",
                            appId, env, e.getMessage());
                }
            }

            logger.info("Initialized all permissions for app: {}", appId);

        } catch (Exception e) {
            logger.error("Failed to init all permissions for app {}: {}", appId, e.getMessage());
            throw new BadRequestException("初始化应用权限失败: " + e.getMessage());
        }
    }

    /**
     * 🆕 批量添加应用的所有权限到角色模板
     */
    @Transactional
    public BatchOperationResult addFullAppPermissionsToTemplate(String templateName,
                                                                List<String> appIds,
                                                                String operator) {
        List<String> successList = new ArrayList<>();
        List<String> failedList = new ArrayList<>();

        for (String appId : appIds) {
            try {
                // 1. 初始化应用的所有权限
                initAllAppPermissions(appId, operator);

                // 2. 构建完整的权限配置
                List<AppPermissionConfig> configs = buildFullAppPermissionConfigs(appId);

                // 3. 添加到角色模板
                BatchOperationResult result = addAppsToTemplate(templateName, configs, operator);

                if (result.getFailed() == 0) {
                    successList.add(appId);
                } else {
                    failedList.add(appId + ": 部分权限添加失败");
                }

            } catch (Exception e) {
                failedList.add(appId + ": " + e.getMessage());
                logger.error("Failed to add full permissions for app {} to template {}: {}",
                        appId, templateName, e.getMessage());
            }
        }

        return new BatchOperationResult(successList, failedList);
    }

    /**
     * 🆕 构建应用的完整权限配置
     */
    private List<AppPermissionConfig> buildFullAppPermissionConfigs(String appId) {
        List<AppPermissionConfig> configs = new ArrayList<>();

        // 1. 应用级权限
        AppPermissionConfig appLevelConfig = new AppPermissionConfig();
        appLevelConfig.setAppId(appId);
        appLevelConfig.setPermissionTypes(Arrays.asList(
                PermissionType.CREATE_CLUSTER,
                PermissionType.CREATE_NAMESPACE,
                PermissionType.ASSIGN_ROLE,
                PermissionType.MANAGE_APP_MASTER
        ));
        configs.add(appLevelConfig);

        // 2. 默认命名空间权限（所有环境）
        AppPermissionConfig nsConfig = new AppPermissionConfig();
        nsConfig.setAppId(appId);
        nsConfig.setNamespaceName("application");
        nsConfig.setPermissionTypes(Arrays.asList(
                PermissionType.MODIFY_NAMESPACE,
                PermissionType.RELEASE_NAMESPACE
        ));
        configs.add(nsConfig);

        // 3. 各环境的命名空间权限
        List<Env> supportedEnvs = portalConfig.portalSupportedEnvs();
        for (Env env : supportedEnvs) {
            AppPermissionConfig envNsConfig = new AppPermissionConfig();
            envNsConfig.setAppId(appId);
            envNsConfig.setNamespaceName("application");
            envNsConfig.setEnv(env.toString());
            envNsConfig.setPermissionTypes(Arrays.asList(
                    PermissionType.MODIFY_NAMESPACE,
                    PermissionType.RELEASE_NAMESPACE
            ));
            configs.add(envNsConfig);

            // 4. 默认集群权限
            AppPermissionConfig clusterConfig = new AppPermissionConfig();
            clusterConfig.setAppId(appId);
            clusterConfig.setClusterName("default");
            clusterConfig.setEnv(env.toString());
            clusterConfig.setPermissionTypes(Arrays.asList(
                    PermissionType.MODIFY_NAMESPACES_IN_CLUSTER,
                    PermissionType.RELEASE_NAMESPACES_IN_CLUSTER
            ));
            configs.add(clusterConfig);
        }

        return configs;
    }

    /**
     * 提取系统级权限
     */
    private List<String> extractSystemPermissions(List<Permission> permissions) {
        return permissions.stream()
                .map(Permission::getPermissionType)
                .filter(this::isSystemPermission)
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * 判断是否为系统级权限
     */
    private boolean isSystemPermission(String permissionType) {
        return PermissionType.CREATE_APPLICATION.equals(permissionType);
    }

    /**
     * 提取应用权限并按应用分组
     */
    private List<AppPermissionSummary> extractAppPermissions(List<Permission> permissions) {
        // 过滤出应用相关权限
        List<Permission> appRelatedPermissions = permissions.stream()
                .filter(p -> !isSystemPermission(p.getPermissionType()))
                .collect(Collectors.toList());

        // 按应用分组
        Map<String, List<Permission>> permissionsByApp = appRelatedPermissions.stream()
                .collect(Collectors.groupingBy(p -> extractAppId(p.getTargetId())));

        List<AppPermissionSummary> appPermissions = new ArrayList<>();

        for (Map.Entry<String, List<Permission>> entry : permissionsByApp.entrySet()) {
            String appId = entry.getKey();
            List<Permission> appPerms = entry.getValue();

            AppPermissionSummary appSummary = new AppPermissionSummary();
            appSummary.setAppId(appId);
            appSummary.setAppLevelPermissions(extractAppLevelPermissions(appPerms));
            appSummary.setNamespacePermissions(extractNamespacePermissions(appPerms));
            appSummary.setClusterPermissions(extractClusterPermissions(appPerms));

            appPermissions.add(appSummary);
        }

        return appPermissions;
    }

    /**
     * 提取应用级权限
     */
    private List<String> extractAppLevelPermissions(List<Permission> permissions) {
        return permissions.stream()
                .filter(p -> isAppLevelPermission(p.getPermissionType()))
                .map(Permission::getPermissionType)
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * 判断是否为应用级权限
     */
    private boolean isAppLevelPermission(String permissionType) {
        return Arrays.asList(
                PermissionType.CREATE_CLUSTER,
                PermissionType.CREATE_NAMESPACE,
                PermissionType.ASSIGN_ROLE,
                PermissionType.MANAGE_APP_MASTER
        ).contains(permissionType);
    }

    /**
     * 提取命名空间权限并分组
     */
    private List<NamespacePermissionSummary> extractNamespacePermissions(List<Permission> permissions) {
        // 过滤命名空间级权限
        List<Permission> namespacePerms = permissions.stream()
                .filter(p -> isNamespacePermission(p.getPermissionType()))
                .collect(Collectors.toList());

        // 按 namespaceName + env 分组
        Map<String, List<Permission>> groupedPerms = namespacePerms.stream()
                .collect(Collectors.groupingBy(p -> {
                    String[] parts = p.getTargetId().split("\\+");
                    String namespaceName = parts.length > 1 ? parts[1] : "";
                    String env = parts.length > 2 ? parts[2] : "";
                    return namespaceName + "|" + env;  // 使用 | 作为分隔符
                }));

        List<NamespacePermissionSummary> namespacePermissions = new ArrayList<>();

        for (Map.Entry<String, List<Permission>> entry : groupedPerms.entrySet()) {
            String key = entry.getKey();
            String[] keyParts = key.split("\\|");
            String namespaceName = keyParts[0];
            String env = keyParts.length > 1 && !keyParts[1].isEmpty() ? keyParts[1] : null;

            List<String> permissionTypes = entry.getValue().stream()
                    .map(Permission::getPermissionType)
                    .distinct()
                    .collect(Collectors.toList());

            NamespacePermissionSummary nsSummary = new NamespacePermissionSummary();
            nsSummary.setNamespaceName(namespaceName);
            nsSummary.setEnv(env);
            nsSummary.setPermissions(permissionTypes);

            namespacePermissions.add(nsSummary);
        }

        return namespacePermissions;
    }

    /**
     * 判断是否为命名空间级权限
     */
    private boolean isNamespacePermission(String permissionType) {
        return Arrays.asList(PermissionType.MODIFY_NAMESPACE, PermissionType.RELEASE_NAMESPACE)
                .contains(permissionType);
    }

    /**
     * 提取集群权限并分组
     */
    private List<ClusterPermissionSummary> extractClusterPermissions(List<Permission> permissions) {
        // 过滤集群级权限
        List<Permission> clusterPerms = permissions.stream()
                .filter(p -> isClusterPermission(p.getPermissionType()))
                .collect(Collectors.toList());

        // 按 clusterName + env 分组
        Map<String, List<Permission>> groupedPerms = clusterPerms.stream()
                .collect(Collectors.groupingBy(p -> {
                    String[] parts = p.getTargetId().split("\\+");
                    String clusterName = parts.length > 1 ? parts[1] : "";
                    String env = parts.length > 2 ? parts[2] : "";
                    return clusterName + "|" + env;
                }));

        List<ClusterPermissionSummary> clusterPermissions = new ArrayList<>();

        for (Map.Entry<String, List<Permission>> entry : groupedPerms.entrySet()) {
            String key = entry.getKey();
            String[] keyParts = key.split("\\|");
            String clusterName = keyParts[0];
            String env = keyParts.length > 1 && !keyParts[1].isEmpty() ? keyParts[1] : null;

            List<String> permissionTypes = entry.getValue().stream()
                    .map(Permission::getPermissionType)
                    .distinct()
                    .collect(Collectors.toList());

            ClusterPermissionSummary clusterSummary = new ClusterPermissionSummary();
            clusterSummary.setClusterName(clusterName);
            clusterSummary.setEnv(env);
            clusterSummary.setPermissions(permissionTypes);

            clusterPermissions.add(clusterSummary);
        }

        return clusterPermissions;
    }

    /**
     * 判断是否为集群级权限
     */
    private boolean isClusterPermission(String permissionType) {
        return Arrays.asList(PermissionType.MODIFY_NAMESPACES_IN_CLUSTER, PermissionType.RELEASE_NAMESPACES_IN_CLUSTER)
                .contains(permissionType);
    }

    // ========== 辅助方法 ==========

    /**
     * 从 targetId 提取 appId
     */
    private String extractAppId(String targetId) {
        if (targetId == null || targetId.isEmpty() || "SystemRole".equals(targetId)) {
            return "";
        }
        String[] parts = targetId.split("\\+");
        return parts[0];
    }

    /**
     * 从 targetId 提取 namespaceName
     */
    private String extractNamespaceName(String targetId) {
        if (targetId == null || targetId.isEmpty()) {
            return null;
        }
        String[] parts = targetId.split("\\+");
        return parts.length > 1 ? parts[1] : null;
    }

    /**
     * 从 targetId 提取 env
     */
    private String extractEnv(String targetId) {
        if (targetId == null || targetId.isEmpty()) {
            return null;
        }
        String[] parts = targetId.split("\\+");
        return parts.length > 2 ? parts[2] : null;
    }
}
