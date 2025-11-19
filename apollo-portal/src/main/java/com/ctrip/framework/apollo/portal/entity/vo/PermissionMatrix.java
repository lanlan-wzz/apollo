package com.ctrip.framework.apollo.portal.entity.vo;

import java.util.List;

/**
 * 前端权限矩阵所需的元数据
 */
public class PermissionMatrix {

  private List<String> systemPermissions;
  private List<String> appPermissions;
  private List<String> namespacePermissions;
  private List<String> clusterPermissions;
  private List<EnvPermissionTarget> envTargets;

  public List<String> getSystemPermissions() {
    return systemPermissions;
  }

  public void setSystemPermissions(List<String> systemPermissions) {
    this.systemPermissions = systemPermissions;
  }

  public List<String> getAppPermissions() {
    return appPermissions;
  }

  public void setAppPermissions(List<String> appPermissions) {
    this.appPermissions = appPermissions;
  }

  public List<String> getNamespacePermissions() {
    return namespacePermissions;
  }

  public void setNamespacePermissions(List<String> namespacePermissions) {
    this.namespacePermissions = namespacePermissions;
  }

  public List<String> getClusterPermissions() {
    return clusterPermissions;
  }

  public void setClusterPermissions(List<String> clusterPermissions) {
    this.clusterPermissions = clusterPermissions;
  }

  public List<EnvPermissionTarget> getEnvTargets() {
    return envTargets;
  }

  public void setEnvTargets(List<EnvPermissionTarget> envTargets) {
    this.envTargets = envTargets;
  }
}
