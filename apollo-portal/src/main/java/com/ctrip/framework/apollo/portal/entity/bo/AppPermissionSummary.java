package com.ctrip.framework.apollo.portal.entity.bo;

import java.util.List;

/**
 * 应用权限汇总
 */
public class AppPermissionSummary {

    private String appId;
    private List<String> appLevelPermissions;
    private List<NamespacePermissionSummary> namespacePermissions;
    private List<ClusterPermissionSummary> clusterPermissions;

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public List<String> getAppLevelPermissions() {
        return appLevelPermissions;
    }

    public void setAppLevelPermissions(List<String> appLevelPermissions) {
        this.appLevelPermissions = appLevelPermissions;
    }

    public List<NamespacePermissionSummary> getNamespacePermissions() {
        return namespacePermissions;
    }

    public void setNamespacePermissions(List<NamespacePermissionSummary> namespacePermissions) {
        this.namespacePermissions = namespacePermissions;
    }

    public List<ClusterPermissionSummary> getClusterPermissions() {
        return clusterPermissions;
    }

    public void setClusterPermissions(List<ClusterPermissionSummary> clusterPermissions) {
        this.clusterPermissions = clusterPermissions;
    }
}
