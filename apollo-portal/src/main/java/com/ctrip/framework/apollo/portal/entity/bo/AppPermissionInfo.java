package com.ctrip.framework.apollo.portal.entity.bo;

import java.util.HashMap;
import java.util.Map;

/**
 * 应用权限信息
 */
public class AppPermissionInfo {

    private String appId;
    private Map<String, String> permissions;  // permissionType -> targetId

    public AppPermissionInfo() {
        this.permissions = new HashMap<>();
    }

    public AppPermissionInfo(String appId) {
        this.appId = appId;
        this.permissions = new HashMap<>();
    }

    public void addPermission(String permissionType, String targetId) {
        this.permissions.put(permissionType, targetId);
    }

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public Map<String, String> getPermissions() {
        return permissions;
    }

    public void setPermissions(Map<String, String> permissions) {
        this.permissions = permissions;
    }
}
