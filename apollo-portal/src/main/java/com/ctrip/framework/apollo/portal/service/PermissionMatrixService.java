package com.ctrip.framework.apollo.portal.service;

import com.ctrip.framework.apollo.common.dto.ClusterDTO;
import com.ctrip.framework.apollo.common.dto.NamespaceDTO;
import com.ctrip.framework.apollo.portal.component.PortalSettings;
import com.ctrip.framework.apollo.portal.component.config.PortalConfig;
import com.ctrip.framework.apollo.portal.constant.PermissionType;
import com.ctrip.framework.apollo.portal.entity.vo.ClusterPermissionTarget;
import com.ctrip.framework.apollo.portal.entity.vo.EnvPermissionTarget;
import com.ctrip.framework.apollo.portal.entity.vo.PermissionMatrix;
import com.ctrip.framework.apollo.portal.environment.Env;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 聚合权限目标元数据，提供给前端构建批量授权矩阵
 */
@Service
public class PermissionMatrixService {

  private static final Logger LOGGER = LoggerFactory.getLogger(PermissionMatrixService.class);

  private final PortalConfig portalConfig;
  private final PortalSettings portalSettings;
  private final ClusterService clusterService;
  private final NamespaceService namespaceService;

  public PermissionMatrixService(
      final PortalConfig portalConfig,
      final PortalSettings portalSettings,
      final ClusterService clusterService,
      final NamespaceService namespaceService) {
    this.portalConfig = portalConfig;
    this.portalSettings = portalSettings;
    this.clusterService = clusterService;
    this.namespaceService = namespaceService;
  }

  public PermissionMatrix buildPermissionMatrix(String appId) {
    PermissionMatrix matrix = new PermissionMatrix();
    matrix.setSystemPermissions(Collections.singletonList(PermissionType.CREATE_APPLICATION));
    matrix.setAppPermissions(buildAppPermissionTypes());
    matrix.setNamespacePermissions(buildNamespacePermissionTypes());
    matrix.setClusterPermissions(buildClusterPermissionTypes());
    matrix.setEnvTargets(loadEnvTargets(appId));
    return matrix;
  }

  private List<String> buildAppPermissionTypes() {
    List<String> permissions = new ArrayList<>();
    permissions.add(PermissionType.CREATE_CLUSTER);
    permissions.add(PermissionType.CREATE_NAMESPACE);
    permissions.add(PermissionType.ASSIGN_ROLE);
    permissions.add(PermissionType.MANAGE_APP_MASTER);
    return permissions;
  }

  private List<String> buildNamespacePermissionTypes() {
    return Arrays.asList(PermissionType.MODIFY_NAMESPACE, PermissionType.RELEASE_NAMESPACE);
  }

  private List<String> buildClusterPermissionTypes() {
    return Arrays.asList(PermissionType.MODIFY_NAMESPACES_IN_CLUSTER,
        PermissionType.RELEASE_NAMESPACES_IN_CLUSTER);
  }

  private List<EnvPermissionTarget> loadEnvTargets(String appId) {
    List<EnvPermissionTarget> envTargets = new ArrayList<>();
    List<Env> envs = portalConfig.portalSupportedEnvs();
    for (Env env : envs) {
      EnvPermissionTarget envTarget = new EnvPermissionTarget();
      envTarget.setEnv(env.toString());
      envTarget.setActive(portalSettings.isEnvActive(env));
      try {
        List<ClusterDTO> clusters = clusterService.findClusters(env, appId);
        envTarget.setClusters(buildClusterTargets(appId, env, clusters));
      } catch (Throwable ex) {
        envTarget.setLoadFailed(true);
        envTarget.setMessage(ex.getMessage());
        LOGGER.warn("Load permission matrix failed for app {} env {}",
            appId, env, ex);
      }
      envTargets.add(envTarget);
    }
    return envTargets;
  }

  private List<ClusterPermissionTarget> buildClusterTargets(String appId, Env env,
      List<ClusterDTO> clusters) {
    List<ClusterPermissionTarget> targets = new ArrayList<>();
    if (clusters == null) {
      return targets;
    }
    for (ClusterDTO cluster : clusters) {
      ClusterPermissionTarget target = new ClusterPermissionTarget();
      target.setClusterName(cluster.getName());
      target.setNamespaces(loadNamespaceNames(appId, env, cluster.getName()));
      targets.add(target);
    }
    targets.sort(Comparator.comparing(ClusterPermissionTarget::getClusterName));
    return targets;
  }

  private List<String> loadNamespaceNames(String appId, Env env, String clusterName) {
    try {
      List<NamespaceDTO> namespaces = namespaceService.findNamespaces(appId, env, clusterName);
      if (namespaces == null) {
        return Collections.emptyList();
      }
        return namespaces.stream()
                .map(NamespaceDTO::getNamespaceName).distinct().sorted(String::compareToIgnoreCase).collect(Collectors.toList());
    } catch (Throwable ex) {
      LOGGER.warn("Load namespace meta failed, appId={}, env={}, cluster={}",
          appId, env, clusterName, ex);
      return Collections.emptyList();
    }
  }
}
