package com.ctrip.framework.apollo.portal.entity.vo;

import java.util.List;

/**
 * 应用权限配置
 */
public class AppPermissionConfig {

    private String appId;
    private List<String> permissionTypes;  // ["ModifyNamespace", "ReleaseNamespace"]
    private String namespaceName;          // 可选，为空表示应用级权限
    private String env;                    // 可选，为空表示所有环境
    private String clusterName;

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public List<String> getPermissionTypes() {
        return permissionTypes;
    }

    public void setPermissionTypes(List<String> permissionTypes) {
        this.permissionTypes = permissionTypes;
    }

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

    // 🆕 新增
    public String getClusterName() {
        return clusterName;
    }

    public void setClusterName(String clusterName) {
        this.clusterName = clusterName;
    }
}
