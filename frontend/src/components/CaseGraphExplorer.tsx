/**
 * CaseGraphExplorer — Refined 3D TigerGraph Neighborhood View.
 * Implements physically-shaded 3D tactile spheres, curved tube edges with pattern pulses,
 * soft contact shadows on a light neutral canvas, billboard label chips with leader lines,
 * and deliberate handling of partial/pending data states.
 */
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import type { CaseDetail } from '../api/types';
import { formatUSD } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types & Palette
// ---------------------------------------------------------------------------
type NodeType = 'Transaction' | 'Card' | 'Customer' | 'Device' | 'IP' | 'MerchCat';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  fullLabel: string;
  isPending: boolean;
  position: [number, number, number];
  isFocal: boolean;
  isMatchedPattern: boolean;
  radius: number;
  properties?: Record<string, string | number>;
}

interface GraphEdge {
  from: [number, number, number];
  to: [number, number, number];
  label: string;
  isPatternPath: boolean;
  isPrimary: boolean;
}

const NODE_PALETTE: Record<
  NodeType,
  { color: string; emissive: string; icon: string; defaultName: string }
> = {
  Transaction: { color: '#E05252', emissive: '#4A1111', icon: '💳', defaultName: 'Transaction' },
  Card:        { color: '#3B82F6', emissive: '#0F2B5C', icon: '🪪', defaultName: 'Card Account' },
  Customer:    { color: '#8B5CF6', emissive: '#2E1065', icon: '👤', defaultName: 'Customer' },
  Device:      { color: '#F59E0B', emissive: '#451A03', icon: '📱', defaultName: 'Device Profile' },
  IP:          { color: '#EC4899', emissive: '#500724', icon: '🌐', defaultName: 'IP Address' },
  MerchCat:   { color: '#10B981', emissive: '#022C22', icon: '🏪', defaultName: 'Merchant Category' },
};

// ---------------------------------------------------------------------------
// Graph Topology Builder
// ---------------------------------------------------------------------------
function buildGraphData(c: CaseDetail): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs: any = c?.case;

  if (!cs) {
    return { nodes: [], edges: [] };
  }

  const pattern = (cs.pattern || '').toLowerCase();
  const evidenceList: Array<{ claim?: string }> = Array.isArray(cs.evidence) ? cs.evidence : [];

  const push = (
    id: string,
    type: NodeType,
    rawLabel: string,
    isPending: boolean,
    pos: [number, number, number],
    radius: number,
    focal = false,
    matched = false,
    props?: Record<string, string | number>
  ) => {
    const truncated = rawLabel.length > 15 ? rawLabel.slice(0, 14) + '…' : rawLabel;
    nodes.push({
      id,
      type,
      label: truncated,
      fullLabel: rawLabel,
      isPending,
      position: pos,
      radius,
      isFocal: focal,
      isMatchedPattern: matched,
      properties: props,
    });
  };

  // 1. Transaction (Center, prominent focal node)
  const rawTxnId = cs.flagged_txn_id || cs.first_suspicious_txn_id || cs.affected_txn_ids?.[0];
  let txnId = rawTxnId;
  let txnPending = false;
  if (!txnId) {
    console.warn('[CaseGraphExplorer] Missing real transaction ID in case data; marking as pending');
    txnId = 'Transaction';
    txnPending = true;
  }
  push(
    txnId,
    'Transaction',
    txnId,
    txnPending,
    [0, 0, 0],
    0.65,
    true,
    true,
    {
      Amount: formatUSD(cs.exposure_usd || 0),
      Pattern: cs.pattern || 'Unclassified',
      Verdict: cs.verdict || 'Uncertain',
      Confidence: `${Math.round((cs.fraud_probability || 0) * 100)}%`,
    }
  );

  // 2. Card Account
  let rawCardId = cs.connected_card_ids?.[0] || cs.card_id;
  if (!rawCardId) {
    const cardClaim = evidenceList.find(e => typeof e.claim === 'string' && e.claim.includes('Card '));
    const match = cardClaim?.claim?.match(/Card ([A-Za-z0-9_-]+)/);
    if (match) rawCardId = match[1];
  }
  let cardId = rawCardId;
  let cardPending = false;
  if (!cardId) {
    console.warn('[CaseGraphExplorer] Missing real card ID in case data; marking as pending');
    cardId = 'Payment Card';
    cardPending = true;
  }
  const isCardPattern = pattern.includes('card') || pattern.includes('takeover');
  push(
    cardId,
    'Card',
    cardId,
    cardPending,
    [-2.4, 0.7, 0.5],
    0.48,
    false,
    isCardPattern,
    { Card: cardId, Type: 'Credit/Debit' }
  );
  edges.push({
    from: [-2.4, 0.7, 0.5],
    to: [0, 0, 0],
    label: 'used_card',
    isPrimary: true,
    isPatternPath: isCardPattern,
  });

  // 3. Customer
  let rawCustId = cs.customer_id;
  if (!rawCustId && rawCardId && rawCardId.includes('-')) {
    rawCustId = rawCardId.split('-')[0];
  }
  if (!rawCustId) {
    const custClaim = evidenceList.find(e => typeof e.claim === 'string' && e.claim.includes('Customer '));
    const match = custClaim?.claim?.match(/Customer ([A-Za-z0-9_-]+)/);
    if (match) rawCustId = match[1];
  }
  let custId = rawCustId;
  let custPending = false;
  if (!custId) {
    console.warn('[CaseGraphExplorer] Missing real customer ID in case data; marking as pending');
    custId = 'Customer';
    custPending = true;
  }
  const isCustPattern = pattern.includes('takeover');
  push(
    custId,
    'Customer',
    custId,
    custPending,
    [-3.8, -0.6, -0.6],
    0.46,
    false,
    isCustPattern,
    { Customer: custId }
  );
  edges.push({
    from: [-3.8, -0.6, -0.6],
    to: [-2.4, 0.7, 0.5],
    label: 'belongs_to',
    isPrimary: true,
    isPatternPath: isCustPattern,
  });

  // 4. Device Profiles
  const devices: string[] = Array.isArray(cs.connected_device_profiles) ? cs.connected_device_profiles : [];
  const isDevPattern = pattern.includes('device') || pattern.includes('takeover');
  if (devices.length > 0) {
    devices.slice(0, 2).forEach((dev: string, i: number) => {
      const angle = Math.PI * 0.35 + i * 0.65;
      const pos: [number, number, number] = [
        Math.cos(angle) * 2.8,
        Math.sin(angle) * 1.3 + 0.3,
        i * 0.7,
      ];
      const cleanDev = dev.split('|')[0]?.trim() || dev;
      push(
        dev,
        'Device',
        cleanDev,
        false,
        pos,
        0.40,
        false,
        isDevPattern,
        { Profile: dev }
      );
      edges.push({
        from: pos,
        to: [0, 0, 0],
        label: 'has_device',
        isPrimary: false,
        isPatternPath: isDevPattern,
      });
    });
  } else {
    console.warn('[CaseGraphExplorer] No device profile in case data; marking as pending');
    push(
      'device-pending',
      'Device',
      'Device Profile',
      true,
      [2.5, 1.3, 0.4],
      0.38,
      false,
      false,
      { Status: 'No device bound' }
    );
    edges.push({
      from: [2.5, 1.3, 0.4],
      to: [0, 0, 0],
      label: 'has_device',
      isPrimary: false,
      isPatternPath: false,
    });
  }

  // 5. IP Address / Geolocation
  let rawIp = cs.merchant_ip || cs.ip_address;
  let ipPending = false;
  if (!rawIp) {
    console.warn('[CaseGraphExplorer] Missing IP address in case data; marking as pending');
    rawIp = 'IP Address';
    ipPending = true;
  }
  const isIpPattern = pattern.includes('region') || pattern.includes('takeover');
  push(
    rawIp,
    'IP',
    rawIp,
    ipPending,
    [3.1, -0.9, 1.1],
    0.38,
    false,
    isIpPattern,
    { IP: rawIp, Region: cs.billing_region || 'Standard' }
  );
  edges.push({
    from: [3.1, -0.9, 1.1],
    to: [0, 0, 0],
    label: 'located_at',
    isPrimary: false,
    isPatternPath: isIpPattern,
  });

  // 6. Merchant Category
  let rawMerch = cs.merchant_category || cs.merchant_name;
  if (!rawMerch) {
    const prodClaim = evidenceList.find(e => typeof e.claim === 'string' && e.claim.includes('product_cd='));
    const match = prodClaim?.claim?.match(/product_cd=([^,\s]+)/);
    if (match) rawMerch = `Product ${match[1]}`;
  }
  let merchPending = false;
  if (!rawMerch) {
    console.warn('[CaseGraphExplorer] Missing merchant category in case data; marking as pending');
    rawMerch = 'Merchant Category';
    merchPending = true;
  }
  push(
    rawMerch,
    'MerchCat',
    rawMerch,
    merchPending,
    [-1.2, -2.4, -0.9],
    0.40,
    false,
    false,
    { Category: rawMerch }
  );
  edges.push({
    from: [-1.2, -2.4, -0.9],
    to: [0, 0, 0],
    label: 'merch_cat',
    isPrimary: false,
    isPatternPath: false,
  });

  // 7. Extra cluster transactions
  const extraTxns = Array.isArray(cs.affected_txn_ids) ? cs.affected_txn_ids.slice(1, 3) : [];
  extraTxns.forEach((txn: string, i: number) => {
    const pos: [number, number, number] = [1.4 + i * 1.3, -2.2 + i * 0.3, 0.8 + i * 0.4];
    push(txn, 'Transaction', txn, false, pos, 0.42, false, true, { LinkedTxn: txn });
    edges.push({
      from: pos,
      to: [0, 0, 0],
      label: 'cluster_txn',
      isPrimary: false,
      isPatternPath: true,
    });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// 3D Curved Tube Edge with optional traveling pulse
// ---------------------------------------------------------------------------
interface CurvedEdgeProps {
  edge: GraphEdge;
  reducedMotion: boolean;
}

const CurvedEdge: React.FC<CurvedEdgeProps> = ({ edge, reducedMotion }) => {
  const particleRef = useRef<THREE.Mesh>(null!);

  const { curve, geometry } = useMemo(() => {
    const vFrom = new THREE.Vector3(...edge.from);
    const vTo = new THREE.Vector3(...edge.to);
    const mid = new THREE.Vector3().addVectors(vFrom, vTo).multiplyScalar(0.5);
    const dist = vFrom.distanceTo(vTo);
    mid.y += Math.min(0.28, dist * 0.12);
    const c = new THREE.QuadraticBezierCurve3(vFrom, mid, vTo);
    const radius = edge.isPrimary ? 0.034 : 0.022;
    const geom = new THREE.TubeGeometry(c, 24, radius, 8, false);
    return { curve: c, geometry: geom };
  }, [edge.from, edge.to, edge.isPrimary]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(state => {
    if (reducedMotion || !edge.isPatternPath || !particleRef.current) return;
    const t = (state.clock.elapsedTime * 0.35) % 1;
    const pt = curve.getPointAt(t);
    particleRef.current.position.copy(pt);
  });

  const edgeColor = edge.isPatternPath ? '#64748B' : '#CBD5E1';
  const edgeOpacity = edge.isPatternPath ? 0.85 : 0.4;

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={edgeColor}
          roughness={0.35}
          metalness={0.25}
          transparent
          opacity={edgeOpacity}
        />
      </mesh>

      {edge.isPatternPath && !reducedMotion && (
        <mesh ref={particleRef}>
          <sphereGeometry args={[0.075, 14, 14]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#3B82F6" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// 3D Tactile Node Mesh with selection ring & billboard chip
// ---------------------------------------------------------------------------
interface NodeMeshProps {
  node: GraphNode;
  isSelected: boolean;
  onSelect: (node: GraphNode) => void;
  reducedMotion: boolean;
}

const NodeMesh: React.FC<NodeMeshProps> = ({ node, isSelected, onSelect, reducedMotion }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const sphereRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  const palette = NODE_PALETTE[node.type];
  const basePos = useMemo(() => new THREE.Vector3(...node.position), [node.position]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Hover lift & scale interpolation
    const liftY = hovered ? 0.22 : 0;
    const targetY = basePos.y + liftY;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      Math.min(delta * 9, 1)
    );

    // Pulse matched pattern nodes
    if (sphereRef.current) {
      let targetScale = isSelected ? 1.18 : hovered ? 1.08 : 1.0;
      if (node.isMatchedPattern && !reducedMotion && !hovered && !isSelected) {
        const pulse = Math.sin(state.clock.elapsedTime * 2.8) * 0.035;
        targetScale += pulse;
      }
      const cur = sphereRef.current.scale.x;
      sphereRef.current.scale.setScalar(
        THREE.MathUtils.lerp(cur, targetScale, Math.min(delta * 10, 1))
      );
    }

    // Rotate crisp selection ring
    if (ringRef.current && !reducedMotion) {
      ringRef.current.rotation.z += delta * 0.6;
    }
  });

  return (
    <group ref={groupRef} position={node.position}>
      {/* 3D Tactile Sphere with Physical Material Shading */}
      <mesh
        ref={sphereRef}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerLeave={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[node.radius, 36, 36]} />
        <meshPhysicalMaterial
          color={palette.color}
          roughness={0.28}
          metalness={0.15}
          clearcoat={0.45}
          clearcoatRoughness={0.15}
          reflectivity={0.65}
        />
      </mesh>

      {/* Crisp selection ring for matched pattern nodes (replaces glow halo) */}
      {node.isMatchedPattern && (
        <mesh ref={ringRef} position={[0, 0, 0]} rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[node.radius * 1.35, 0.022, 16, 64]} />
          <meshBasicMaterial
            color={palette.color}
            transparent
            opacity={isSelected ? 0.95 : 0.75}
          />
        </mesh>
      )}

      {/* Billboard Label Chip with Vertical Connector Leader */}
      <Html
        center
        position={[0, node.radius + 0.65, 0]}
        style={{ pointerEvents: 'auto', userSelect: 'none' }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node);
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          {/* Card Chip */}
          <div
            title={node.fullLabel}
            style={{
              background: '#FFFFFF',
              border: isSelected
                ? `1.5px solid ${palette.color}`
                : hovered
                ? '1px solid #94A3B8'
                : '1px solid rgba(226, 232, 240, 0.95)',
              boxShadow: hovered || isSelected
                ? '0 10px 22px -3px rgba(15, 23, 42, 0.14), 0 4px 8px -2px rgba(15, 23, 42, 0.06)'
                : '0 3px 8px -1px rgba(15, 23, 42, 0.08), 0 1px 3px -1px rgba(15, 23, 42, 0.04)',
              borderRadius: 10,
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transform: hovered ? 'translateY(-2px)' : 'none',
              transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>{palette.icon}</span>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                fontWeight: 600,
                color: '#1E293B',
                letterSpacing: '-0.01em',
              }}
            >
              {node.label}
            </span>
            {node.isPending && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: '#64748B',
                  background: '#F1F5F9',
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                ID pending
              </span>
            )}
            {node.isMatchedPattern && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: palette.color,
                }}
              />
            )}
          </div>

          {/* Crisp leader line to sphere */}
          <div
            style={{
              width: 1.5,
              height: 14,
              background: isSelected ? palette.color : 'rgba(148, 163, 184, 0.65)',
              transition: 'background 0.2s',
            }}
          />
          <div
            style={{
              width: 4.5,
              height: 4.5,
              borderRadius: '50%',
              background: isSelected ? palette.color : 'rgba(148, 163, 184, 0.65)',
              marginTop: -1,
            }}
          />
        </div>
      </Html>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Camera Dolly Controller (focuses on selected node)
// ---------------------------------------------------------------------------
const CameraController: React.FC<{
  selectedNode: GraphNode | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ selectedNode, controlsRef }) => {
  useFrame((_, delta) => {
    if (!controlsRef.current) return;
    const target = selectedNode
      ? new THREE.Vector3(...selectedNode.position)
      : new THREE.Vector3(0, 0, 0);

    controlsRef.current.target.lerp(target, Math.min(delta * 4.5, 1));
    controlsRef.current.update();
  });

  return null;
};

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
const GraphLegend: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 16,
      left: 16,
      background: 'rgba(255, 255, 255, 0.94)',
      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
      border: '1px solid rgba(226, 232, 240, 0.85)',
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      pointerEvents: 'none',
      zIndex: 10,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: 2,
      }}
    >
      Node Taxonomy
    </div>
    {Object.entries(NODE_PALETTE).map(([type, { color, icon }]) => (
      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: '#334155',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
          }}
        >
          {icon} {type}
        </span>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// 2D Fallback Grid (for prefers-reduced-motion)
// ---------------------------------------------------------------------------
interface FallbackProps {
  nodes: GraphNode[];
  onSelect: (n: GraphNode) => void;
  selectedId: string | null;
}

const FallbackGrid: React.FC<FallbackProps> = ({ nodes, onSelect, selectedId }) => (
  <div
    style={{
      padding: 24,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: 14,
      background: '#F8FAFC',
      borderRadius: 16,
    }}
  >
    {nodes.map(n => {
      const p = NODE_PALETTE[n.type];
      const isSel = selectedId === n.id;
      return (
        <button
          key={n.id}
          onClick={() => onSelect(n)}
          style={{
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            border: isSel ? `2px solid ${p.color}` : '1px solid #E2E8F0',
            borderRadius: 12,
            cursor: 'pointer',
            background: '#FFFFFF',
            boxShadow: isSel
              ? '0 6px 14px rgba(15, 23, 42, 0.1)'
              : '0 2px 5px rgba(15, 23, 42, 0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: p.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            {p.icon}
          </div>
          <span
            style={{
              fontSize: 11,
              color: '#1E293B',
              fontFamily: 'JetBrains Mono, monospace',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {n.label}
          </span>
          <span style={{ fontSize: 9, color: '#64748B' }}>{n.type}</span>
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
interface CaseGraphExplorerProps {
  caseData: CaseDetail;
  className?: string;
}

export const CaseGraphExplorer: React.FC<CaseGraphExplorerProps> = ({ caseData }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const prefersReduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const { nodes, edges } = useMemo(() => buildGraphData(caseData), [caseData]);

  const handleSelect = (node: GraphNode) => {
    setSelectedNode(prev => (prev?.id === node.id ? null : node));
  };

  return (
    <div
      className="nm-xl"
      style={{
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--nm-surface)',
        borderRadius: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(195, 203, 216, 0.45)',
          background: 'var(--nm-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            className="nm-sm"
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 19,
            }}
          >
            🕸
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-text)',
              }}
            >
              Case Graph Explorer
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                TigerGraph Savanna
              </span>
              <span>·</span>
              <span>
                {nodes.length} nodes · {edges.length} edges
              </span>
              <span>·</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  color: '#B45309',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: 10,
                  letterSpacing: '0.04em',
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#D97706',
                  }}
                />
                TOPOLOGY SYNTHESIS
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {selectedNode && (
            <button
              onClick={() => setSelectedNode(null)}
              className="nm-btn"
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 10 }}
            >
              Reset view
            </button>
          )}
          <div
            className="nm-pill"
            style={{
              padding: '5px 14px',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {prefersReduced ? '2D View Mode' : 'Drag to rotate · Scroll to zoom'}
          </div>
        </div>
      </div>

      {/* Main 3D Canvas / Empty State */}
      <div style={{ height: 490, position: 'relative', background: '#F8FAFC' }}>
        {nodes.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: '#EEF2F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                marginBottom: 12,
              }}
            >
              🕸
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
                marginBottom: 4,
              }}
            >
              No Graph Data for this Case Yet
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Graph neighborhood topology is empty or awaiting live ingest.
            </div>
          </div>
        ) : prefersReduced ? (
          <FallbackGrid
            nodes={nodes}
            onSelect={handleSelect}
            selectedId={selectedNode?.id ?? null}
          />
        ) : (
          <Canvas
            camera={{ position: [0, 0.8, 8.5], fov: 48 }}
            style={{ background: '#F5F7FA' }}
            gl={{ antialias: true, alpha: false }}
          >
            {/* Scene Environment Background & Fog */}
            <color attach="background" args={['#F5F7FA']} />
            <fog attach="fog" args={['#F5F7FA', 18, 36]} />

            {/* Studio Lighting Setup for 3D Tactile Presence */}
            <ambientLight intensity={0.7} color="#F8FAFC" />
            <directionalLight position={[7, 10, 8]} intensity={1.3} color="#FFFBF5" />
            <directionalLight position={[-7, 5, -5]} intensity={0.55} color="#DDE8F5" />
            <directionalLight position={[0, -4, -6]} intensity={0.3} color="#FFFFFF" />

            {/* Subtle Ground Disc & Depth Grid */}
            <mesh position={[0, -3.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[14, 64]} />
              <meshBasicMaterial color="#EEF2F6" transparent opacity={0.65} />
            </mesh>
            <gridHelper
              args={[22, 22, '#DDE3EA', '#EEF2F6']}
              position={[0, -3.16, 0]}
            />

            {/* Soft Real-time Contact Shadows under Nodes */}
            <ContactShadows
              position={[0, -3.15, 0]}
              opacity={0.35}
              scale={20}
              blur={2.4}
              far={6.0}
              color="#475569"
            />

            {/* 3D Curved Edges */}
            {edges.map((e, i) => (
              <CurvedEdge key={i} edge={e} reducedMotion={prefersReduced} />
            ))}

            {/* Tactile 3D Nodes */}
            {nodes.map(n => (
              <NodeMesh
                key={n.id}
                node={n}
                isSelected={selectedNode?.id === n.id}
                onSelect={handleSelect}
                reducedMotion={prefersReduced}
              />
            ))}

            {/* Camera Focusing Controller & Orbit Controls */}
            <CameraController selectedNode={selectedNode} controlsRef={controlsRef} />
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enablePan={false}
              enableDamping
              dampingFactor={0.06}
              minDistance={4.5}
              maxDistance={14.0}
              maxPolarAngle={Math.PI / 2 + 0.08}
              autoRotate={!selectedNode && !prefersReduced}
              autoRotateSpeed={0.3}
            />
          </Canvas>
        )}

        {/* Legend */}
        {nodes.length > 0 && <GraphLegend />}

        {/* Selected Node Inspector Drawer */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: '#FFFFFF',
                boxShadow:
                  '0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
                borderRadius: 16,
                padding: '16px 18px',
                minWidth: 220,
                maxWidth: 280,
                border: '1px solid #E2E8F0',
                borderLeft: `4px solid ${NODE_PALETTE[selectedNode.type].color}`,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 22 }}>
                  {NODE_PALETTE[selectedNode.type].icon}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: NODE_PALETTE[selectedNode.type].color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}
                  >
                    {selectedNode.type}
                  </div>
                  <div
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#0F172A',
                      wordBreak: 'break-all',
                    }}
                  >
                    {selectedNode.fullLabel}
                  </div>
                  {selectedNode.isPending && (
                    <div
                      style={{
                        fontSize: 10,
                        color: '#D97706',
                        fontWeight: 600,
                        marginTop: 2,
                      }}
                    >
                      ⚠️ Identifier Pending Live Graph Sync
                    </div>
                  )}
                </div>
              </div>

              {selectedNode.properties &&
                Object.entries(selectedNode.properties).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      padding: '6px 10px',
                      marginBottom: 6,
                      background: '#F8FAFC',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid #F1F5F9',
                    }}
                  >
                    <span style={{ fontSize: 10, color: '#64748B' }}>{k}</span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#1E293B',
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}

              {selectedNode.isFocal && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#EFF6FF',
                    border: '1px solid #DBEAFE',
                    fontSize: 11,
                    color: '#2563EB',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>⚡</span> Flagged transaction origin
                </div>
              )}

              {selectedNode.isMatchedPattern && !selectedNode.isFocal && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#FEF2F2',
                    border: '1px solid #FEE2E2',
                    fontSize: 10,
                    color: '#DC2626',
                    fontWeight: 600,
                  }}
                >
                  Matched in fraud pattern topology
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
