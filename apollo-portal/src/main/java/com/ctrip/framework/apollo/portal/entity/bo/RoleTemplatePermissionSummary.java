package com.ctrip.framework.apollo.portal.entity.bo;

import java.util.List;

/**
 * 角色模板权限汇总
 */
public class RoleTemplatePermissionSummary {

    private String templateName;
    private List<String> systemPermissions;
    private List<AppPermissionSummary> appPermissions;

    public String getTemplateName() {
        return templateName;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public List<String> getSystemPermissions() {
        return systemPermissions;
    }

    public void setSystemPermissions(List<String> systemPermissions) {
        this.systemPermissions = systemPermissions;
    }

    public List<AppPermissionSummary> getAppPermissions() {
        return appPermissions;
    }

    public void setAppPermissions(List<AppPermissionSummary> appPermissions) {
        this.appPermissions = appPermissions;
    }
}
