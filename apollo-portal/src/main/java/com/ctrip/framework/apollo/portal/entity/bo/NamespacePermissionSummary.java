package com.ctrip.framework.apollo.portal.entity.bo;

import java.util.List;

/**
 * 命名空间权限汇总
 */
public class NamespacePermissionSummary {

    private String namespaceName;
    private String env;  // null 表示所有环境
    private List<String> permissions;

    public String getNamespaceName() {
        return namespaceName;
    }

    public void setNamespaceName(String namespaceName) {
        this.namespaceName = namespaceName;
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
