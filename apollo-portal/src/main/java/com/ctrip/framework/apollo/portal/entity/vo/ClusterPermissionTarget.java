package com.ctrip.framework.apollo.portal.entity.vo;

import java.util.List;

/**
 * 集群维度的权限元数据
 */
public class ClusterPermissionTarget {

  private String clusterName;
  private List<String> namespaces;

  public String getClusterName() {
    return clusterName;
  }

  public void setClusterName(String clusterName) {
    this.clusterName = clusterName;
  }

  public List<String> getNamespaces() {
    return namespaces;
  }

  public void setNamespaces(List<String> namespaces) {
    this.namespaces = namespaces;
  }
}
