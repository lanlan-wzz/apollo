package com.ctrip.framework.apollo.portal.entity.bo;

import java.util.List;

/**
 * 集群权限汇总
 */
public class ClusterPermissionSummary {

    private String clusterName;
    private String env;
    private List<String> permissions;

    public String getClusterName() {
        return clusterName;
    }

    public void setClusterName(String clusterName) {
        this.clusterName = clusterName;
    }

    public String getEnv() {
        return env;
    }

    public void setEnv(String env) {
        this.env = env;
    }

    public List<String> getPermissions() {
        return permissions;
    }

    public void setPermissions(List<String> permissions) {
        this.permissions = permissions;
    }
}
