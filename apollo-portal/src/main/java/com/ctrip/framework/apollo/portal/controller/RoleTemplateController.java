package com.ctrip.framework.apollo.portal.controller;

import com.ctrip.framework.apollo.audit.annotation.ApolloAuditLog;
import com.ctrip.framework.apollo.audit.annotation.OpType;
import com.ctrip.framework.apollo.common.exception.BadRequestException;
import com.ctrip.framework.apollo.portal.entity.bo.AppPermissionInfo;
import com.ctrip.framework.apollo.portal.entity.bo.RoleTemplateInfo;
import com.ctrip.framework.apollo.portal.entity.bo.RoleTemplatePermissionSummary;
import com.ctrip.framework.apollo.portal.entity.bo.TemplatePermissionDetail;
import com.ctrip.framework.apollo.portal.entity.po.Role;
import com.ctrip.framework.apollo.portal.entity.vo.AssignUsersRequest;
import com.ctrip.framework.apollo.portal.entity.vo.BatchAddAppsRequest;
import com.ctrip.framework.apollo.portal.entity.vo.BatchOperationResult;
import com.ctrip.framework.apollo.portal.entity.vo.CreateRoleTemplateRequest;
import com.ctrip.framework.apollo.portal.service.RoleTemplateService;
import com.ctrip.framework.apollo.portal.spi.UserInfoHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 角色模板管理控制器
 * 用于批量权限管理
 */
@RestController
@RequestMapping("/role-templates")
public class RoleTemplateController {

    private final RoleTemplateService roleTemplateService;
    private final UserInfoHolder userInfoHolder;

    public RoleTemplateController(
            final RoleTemplateService roleTemplateService,
            final UserInfoHolder userInfoHolder) {
        this.roleTemplateService = roleTemplateService;
        this.userInfoHolder = userInfoHolder;
    }

    /**
     * 创建角色模板
     */
    @PreAuthorize(value = "@userPermissionValidator.isSuperAdmin()")
    @PostMapping
    @ApolloAuditLog(type = OpType.CREATE, name = "RoleTemplate.create")
    public ResponseEntity<Role> createRoleTemplate(@RequestBody CreateRoleTemplateRequest request) {
        if (!StringUtils.hasText(request.getTemplateName())) {
            throw new BadRequestException("角色模板名称不能为空");
        }

        Role role = roleTemplateService.createRoleTemplate(
                request.getTemplateName(),
                request.getDescription(),
                userInfoHolder.getUser().getUserId()
        );

        return ResponseEntity.ok(role);
    }

    /**
     * 查询所有角色模板
     */
    @GetMapping
    public ResponseEntity<List<RoleTemplateInfo>> listAllTemplates() {
        List<RoleTemplateInfo> templates = roleTemplateService.listAllTemplates();
        return ResponseEntity.ok(templates);
    }

    /**
     * 查询角色模板详情
     */
    @GetMapping("/{templateName}")
    public ResponseEntity<RoleTemplateInfo> getTemplateDetail(@PathVariable String templateName) {
        RoleTemplateInfo info = roleTemplateService.getTemplateDetail(templateName);
        return ResponseEntity.ok(info);
    }

    /**
     * 删除角色模板
     */
    @PreAuthorize(value = "@userPermissionValidator.isSuperAdmin()")
    @DeleteMapping("/{templateName}")
    @ApolloAuditLog(type = OpType.DELETE, name = "RoleTemplate.delete")
    public ResponseEntity<Void> deleteRoleTemplate(@PathVariable String templateName) {
        roleTemplateService.deleteRoleTemplate(
                templateName,
                userInfoHolder.getUser().getUserId()
        );
        return ResponseEntity.ok().build();
    }

    /**
     * 批量添加应用权限到角色模板
     */
    @PreAuthorize(value = "@userPermissionValidator.isSuperAdmin()")
    @PostMapping("/{templateName}/apps")
    @ApolloAuditLog(type = OpType.CREATE, name = "RoleTemplate.addApps")
    public ResponseEntity<BatchOperationResult> addAppsToTemplate(
            @PathVariable String templateName,
            @RequestBody BatchAddAppsRequest request) {

        if (request.getApps() == null || request.getApps().isEmpty()) {
            throw new BadRequestException("应用列表不能为空");
        }

        BatchOperationResult result = roleTemplateService.addAppsToTemplate(
                templateName,
                request.getApps(),
                userInfoHolder.getUser().getUserId()
        );

        return ResponseEntity.ok(result);
    }

    /**
     * 从角色模板移除应用
     */
    @PreAuthorize(value = "@userPermissionValidator.isSuperAdmin()")
    @DeleteMapping("/{templateName}/apps/{appId}")
    @ApolloAuditLog(type = OpType.DELETE, name = "RoleTemplate.removeApp")
    public ResponseEntity<Void> removeAppFromTemplate(
            @PathVariable String templateName,
            @PathVariable String appId) {

        roleTemplateService.removeAppFromTemplate(
                templateName,
                appId,
                userInfoHolder.getUser().getUserId()
        );

        return ResponseEntity.ok().build();
    }

    /**
     * 查询角色模板包含的应用权限
     */
    @GetMapping("/{templateName}/apps")
    public ResponseEntity<List<AppPermissionInfo>> getTemplateApps(
            @PathVariable String templateName) {

        List<AppPermissionInfo> apps = roleTemplateService.getTemplateApps(templateName);
        return ResponseEntity.ok(apps);
    }

    /**
     * 查询角色模板的所有权限详情
     */
    @GetMapping("/{templateName}/permissions")
    public ResponseEntity<List<TemplatePermissionDetail>> getTemplatePermissions(
            @PathVariable String templateName) {

        List<TemplatePermissionDetail> permissions =
                roleTemplateService.getTemplatePermissions(templateName);
        return ResponseEntity.ok(permissions);
    }

    /**
     * 查询角色模板权限汇总（结构化格式）
     */
    @GetMapping("/{templateName}/permission-summary")
    public ResponseEntity<RoleTemplatePermissionSummary> getTemplatePermissionSummary(
            @PathVariable String templateName) {

        RoleTemplatePermissionSummary summary =
                roleTemplateService.getTemplatePermissionSummary(templateName);

        return ResponseEntity.ok(summary);
    }


    /**
     * 给用户批量分配角色模板
     */
    @PreAuthorize(value = "@userPermissionValidator.isSuperAdmin()")
    @PostMapping("/{templateName}/users")
    @ApolloAuditLog(type = OpType.CREATE, name = "RoleTemplate.assignUsers")
    public ResponseEntity<BatchOperationResult> assignTemplateToUsers(
            @PathVariable String templateName,
            @RequestBody AssignUsersRequest request) {

        if (request.getUserIds() == null || request.getUserIds().isEmpty()) {
            throw new BadRequestException("用户列表不能为空");
        }

        BatchOperationResult result = roleTemplateService.assignTemplateToUsers(
                templateName,
                request.getUserIds(),
                userInfoHolder.getUser().getUserId()
        );

        return ResponseEntity.ok(result);
    }

    /**
     * 从用户移除角色模板
     */
    @PreAuthorize(value = "@userPermissionValidator.isSuperAdmin()")
    @DeleteMapping("/{templateName}/users")
    @ApolloAuditLog(type = OpType.DELETE, name = "RoleTemplate.removeUsers")
    public ResponseEntity<BatchOperationResult> removeTemplateFromUsers(
            @PathVariable String templateName,
            @RequestBody AssignUsersRequest request) {

        if (request.getUserIds() == null || request.getUserIds().isEmpty()) {
            throw new BadRequestException("用户列表不能为空");
        }

        BatchOperationResult result = roleTemplateService.removeTemplateFromUsers(
                templateName,
                request.getUserIds(),
                userInfoHolder.getUser().getUserId()
        );

        return ResponseEntity.ok(result);
    }

    /**
     * 查询角色模板下的所有用户
     */
    @GetMapping("/{templateName}/users")
    public ResponseEntity<List<String>> getTemplateUsers(@PathVariable String templateName) {
        List<String> userIds = roleTemplateService.getTemplateUsers(templateName);
        return ResponseEntity.ok(userIds);
    }

    /**
     * 查询用户拥有的角色模板
     */
    @GetMapping("/users/{userId}")
    public ResponseEntity<List<String>> getUserTemplates(@PathVariable String userId) {
        List<String> templates = roleTemplateService.getUserTemplates(userId);
        return ResponseEntity.ok(templates);
    }

    /**
     * 复制角色模板
     */
    @PreAuthorize(value = "@userPermissionValidator.isSuperAdmin()")
    @PostMapping("/{templateName}/copy")
    @ApolloAuditLog(type = OpType.CREATE, name = "RoleTemplate.copy")
    public ResponseEntity<Role> copyRoleTemplate(
            @PathVariable String templateName,
            @RequestParam String newTemplateName) {

        if (!StringUtils.hasText(newTemplateName)) {
            throw new BadRequestException("新角色模板名称不能为空");
        }

        Role role = roleTemplateService.copyRoleTemplate(
                templateName,
                newTemplateName,
                userInfoHolder.getUser().getUserId()
        );

        return ResponseEntity.ok(role);
    }
}
