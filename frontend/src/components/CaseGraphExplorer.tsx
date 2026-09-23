/**
 * CaseGraphExplorer — Neumorphic 3D graph visualization.
 * TEMPORARY/MOCK: Graph topology reconstructed from entity ID fields.
 * Replace `buildGraphData` when the API exposes a raw neighborhood subgraph.
 */
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import type { CaseDetail } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import { formatUSD } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type NodeType = 'Transaction' | 'Card' | 'Customer' | 'Device' | 'IP' | 'MerchCat';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  position: [number, number, number];
  isFocal: boolean;
  properties?: Record<string, string | number>;
}
interface GraphEdge {
  from: [number, number, number];
  to: [number, number, number];
  label: string;
}

// ---------------------------------------------------------------------------
// Color palette — matches neumorphic accents
// ---------------------------------------------------------------------------
const NODE_PALETTE: Record<NodeType, { color: string; emissive: string; size: number; icon: string }> = {
  Transaction: { color: '#E05252', emissive: '#5C0000', size: 0.55, icon: '💳' },
  Card:        { color: '#4F7EF7', emissive: '#00204F', size: 0.45, icon: '🪪' },
  Customer:    { color: '#7C3AED', emissive: '#2D0070', size: 0.50, icon: '👤' },
  Device:      { color: '#D97706', emissive: '#4A2800', size: 0.38, icon: '📱' },
  IP:          { color: '#DB2777', emissive: '#4A002A', size: 0.35, icon: '🌐' },
  MerchCat:   { color: '#059669', emissive: '#003322', size: 0.38, icon: '🏪' },
};

// ---------------------------------------------------------------------------
// TEMPORARY/MOCK: Build graph from entity ID fields
// ---------------------------------------------------------------------------
function buildGraphData(c: CaseDetail): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs: any = c.case; // TEMPORARY/MOCK: cast to any — some fields (merchant_ip, card_id etc.) exist in JSON but not typed

  const push = (id: string, type: NodeType, label: string, pos: [number, number, number], focal = false, props?: Record<string, string | number>) => {
    nodes.push({ id, type, label, position: pos, isFocal: focal, properties: props });
  };

  // Center: flagged transaction
  const txId = cs.flagged_txn_id ?? 'TXN-?';
  push(txId, 'Transaction', txId, [0, 0, 0], true, {
    Amount: formatUSD(cs.exposure_usd),
    Pattern: cs.pattern,
    Verdict: cs.verdict ?? 'unknown',
  });

  // Card
  const cardId = cs.connected_card_ids?.[0] ?? cs.card_id ?? 'CARD-?';
  push(cardId, 'Card', cardId, [-2.2, 0.8, 0.5], false);
  edges.push({ from: [-2.2, 0.8, 0.5], to: [0, 0, 0], label: 'used_card' });

  // Customer
  const custId = cs.customer_id ?? 'CUST-?';
  push(custId, 'Customer', custId, [-3.4, -0.5, -0.8], false, { ID: custId });
  edges.push({ from: [-3.4, -0.5, -0.8], to: [-2.2, 0.8, 0.5], label: 'belongs_to' });

  // Devices
  const devices = cs.connected_device_profiles?.slice(0, 2) ?? [];
  devices.forEach((dev: string, i: number) => {
    const angle = Math.PI * 0.3 + i * 0.6;
    const pos: [number, number, number] = [Math.cos(angle) * 2.5, Math.sin(angle) * 1.2 + 0.4, i * 0.6];
    push(dev, 'Device', dev.slice(0, 12) + '…', pos);
    edges.push({ from: pos, to: [0, 0, 0], label: 'has_device' });
  });
  if (devices.length === 0) {
    push('DEV-??', 'Device', 'DEV-??', [2.2, 1.4, 0], false);
    edges.push({ from: [2.2, 1.4, 0], to: [0, 0, 0], label: 'has_device' });
  }

  // IP
  const ip = cs.merchant_ip ?? '0.0.0.0';
  push(ip, 'IP', ip, [2.8, -1.0, 1.2], false, { IP: ip, Country: cs.merchant_country ?? '?' });
  edges.push({ from: [2.8, -1.0, 1.2], to: [0, 0, 0], label: 'located_at' });

  // Merchant category
  const merch = cs.merchant_category ?? cs.merchant_name ?? 'Unknown';
  push(merch, 'MerchCat', merch.slice(0, 14), [-1.0, -2.2, -1.0], false);
  edges.push({ from: [-1.0, -2.2, -1.0], to: [0, 0, 0], label: 'merch_cat' });

  // Extra transactions
  (cs.affected_txn_ids ?? []).slice(1, 3).forEach((txn: string, i: number) => {
    const pos: [number, number, number] = [1.2 + i * 1.4, -2.0 + i * 0.3, 0.8 + i * 0.5];
    push(txn, 'Transaction', txn, pos);
    edges.push({ from: pos, to: [0, 0, 0], label: 'cluster_txn' });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// 3D Node component
// ---------------------------------------------------------------------------
interface NodeMeshProps {
  node: GraphNode;
  isSelected: boolean;
  onSelect: (node: GraphNode) => void;
}

const NodeMesh: React.FC<NodeMeshProps> = ({ node, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const palette = NODE_PALETTE[node.type];
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const target = isSelected ? 1.22 : hovered ? 1.1 : 1.0;
    const s = meshRef.current.scale.x;
    meshRef.current.scale.setScalar(s + (target - s) * Math.min(delta * 8, 1));
    if (node.isFocal) {
      meshRef.current.rotation.y += delta * 0.6;
    }
  });

  const size = node.isFocal ? palette.size * 1.4 : palette.size;

  return (
    <group position={node.position}>
      {/* Outer glow sphere */}
      {(isSelected || node.isFocal) && (
        <mesh scale={[size * 2.4, size * 2.4, size * 2.4]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={palette.color} transparent opacity={0.05} side={THREE.BackSide} />
        </mesh>
      )}

      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(node); }}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[size, 28, 28]} />
        <meshStandardMaterial
          color={palette.color}
          emissive={palette.emissive}
          emissiveIntensity={isSelected ? 0.6 : hovered ? 0.35 : 0.15}
          roughness={0.35}
          metalness={0.55}
        />
      </mesh>

      {/* Icon label */}
      <Html
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        position={[0, size + 0.3, 0]}
      >
        <div style={{
          background: 'var(--nm-surface)',
          boxShadow: 'var(--shadow-nm-sm)',
          borderRadius: 8,
          padding: '3px 7px',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text)',
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 4,
          border: isSelected ? `1px solid ${palette.color}66` : 'none',
        }}>
          <span>{palette.icon}</span>
          {node.label.length > 12 ? node.label.slice(0, 12) + '…' : node.label}
        </div>
      </Html>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Edge line using THREE.Line primitive
// ---------------------------------------------------------------------------
interface EdgeLineProps { from: [number,number,number]; to: [number,number,number] }

const EdgeLine: React.FC<EdgeLineProps> = ({ from, to }) => {
  const lineRef = useRef<THREE.Line>(null!);

  const geometry = useMemo(() => {
    const pts = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [from, to]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#8B9AB5', transparent: true, opacity: 0.35 }),
    []
  );

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  return <primitive ref={lineRef} object={new THREE.Line(geometry, material)} />;
};

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
const GraphLegend: React.FC = () => (
  <div style={{
    position: 'absolute', top: 16, left: 16,
    background: 'var(--nm-surface)',
    boxShadow: 'var(--shadow-nm-sm)',
    borderRadius: 12, padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: 6,
    pointerEvents: 'none',
  }}>
    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
      Node Types
    </span>
    {Object.entries(NODE_PALETTE).map(([type, { color, icon }]) => (
      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="nm-legend-dot" style={{ background: color }} />
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
          {icon} {type}
        </span>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// 2D Fallback grid (for prefers-reduced-motion)
// ---------------------------------------------------------------------------
interface FallbackProps { nodes: GraphNode[]; onSelect: (n: GraphNode) => void; selectedId: string | null }
const FallbackGrid: React.FC<FallbackProps> = ({ nodes, onSelect, selectedId }) => (
  <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 100px)', gap: 12 }}>
    {nodes.map(n => {
      const p = NODE_PALETTE[n.type];
      return (
        <button key={n.id} onClick={() => onSelect(n)}
          className="nm-sm"
          style={{
            padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            border: 'none', cursor: 'pointer', background: 'var(--nm-surface)',
            boxShadow: selectedId === n.id ? `var(--shadow-nm-inset-sm), 0 0 0 2px ${p.color}` : 'var(--shadow-nm-sm)',
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.icon}</div>
          <span style={{ fontSize: 9, color: 'var(--color-text-secondary)', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', lineHeight: 1.2 }}>
            {n.label.slice(0, 10)}
          </span>
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Main CaseGraphExplorer
// ---------------------------------------------------------------------------
interface CaseGraphExplorerProps {
  caseData: CaseDetail;
  className?: string;
}

export const CaseGraphExplorer: React.FC<CaseGraphExplorerProps> = ({ caseData }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const prefersReduced = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const { nodes, edges } = useMemo(() => buildGraphData(caseData), [caseData]);

  const handleSelect = (node: GraphNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

  return (
    <div
      className="nm-xl"
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      {/* Header */}
      <div style={{
        padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--nm-shadow-dark)', background: 'var(--nm-surface)',
      }}>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
            🕸 Case Graph Explorer
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>TigerGraph Savanna</span>
            {' · '}{nodes.length} nodes · {edges.length} edges
            {' · '}<span style={{ color: 'var(--color-risk-med)' }}>TEMPORARY/MOCK</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selectedNode && (
            <button
              onClick={() => setSelectedNode(null)}
              className="nm-btn"
              style={{ fontSize: 11, padding: '6px 12px', borderRadius: 10 }}
            >
              Clear selection
            </button>
          )}
          <div className="nm-pill" style={{ padding: '5px 12px', fontSize: 10, color: 'var(--color-text-muted)' }}>
            {prefersReduced ? '2D Mode' : 'Drag to rotate · Scroll to zoom'}
          </div>
        </div>
      </div>

      {/* Graph / fallback */}
      <div style={{ height: 440, position: 'relative' }}>
        {prefersReduced ? (
          <FallbackGrid nodes={nodes} onSelect={handleSelect} selectedId={selectedNode?.id ?? null} />
        ) : (
          <Canvas
            camera={{ position: [0, 0, 9], fov: 55 }}
            style={{ background: 'var(--nm-surface)' }}
            gl={{ antialias: true, alpha: false }}
          >
            {/* Lighting */}
            <ambientLight intensity={0.7} />
            <directionalLight position={[-6, 8, 6]} intensity={1.1} color="#ffffff" castShadow />
            <pointLight position={[5, -3, 4]} intensity={0.5} color="#4F7EF7" />
            <pointLight position={[-5, 3, -3]} intensity={0.3} color="#7C3AED" />

            {/* Edges */}
            {edges.map((e, i) => <EdgeLine key={i} from={e.from} to={e.to} />)}

            {/* Nodes */}
            {nodes.map(n => (
              <NodeMesh
                key={n.id}
                node={n}
                isSelected={selectedNode?.id === n.id}
                onSelect={handleSelect}
              />
            ))}

            <OrbitControls enablePan={false} minDistance={4} maxDistance={18} autoRotate={!selectedNode} autoRotateSpeed={0.5} />
          </Canvas>
        )}

        {/* Legend */}
        <GraphLegend />

        {/* Selected node detail panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'var(--nm-surface)',
                boxShadow: 'var(--shadow-nm-md)',
                borderRadius: 16, padding: '16px 18px',
                minWidth: 200, maxWidth: 260,
                borderLeft: `3px solid ${NODE_PALETTE[selectedNode.type].color}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{NODE_PALETTE[selectedNode.type].icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: NODE_PALETTE[selectedNode.type].color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {selectedNode.type}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, color: 'var(--color-text)', lineBreak: 'anywhere' }}>
                    {selectedNode.id}
                  </div>
                </div>
              </div>
              {selectedNode.properties && Object.entries(selectedNode.properties).map(([k, v]) => (
                <div key={k} className="nm-inset-sm" style={{ padding: '6px 10px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{k}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: 'var(--color-text)' }}>{v}</span>
                </div>
              ))}
              {selectedNode.isFocal && (
                <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--color-brand-glow)', fontSize: 10, color: 'var(--color-brand)', fontWeight: 700 }}>
                  ⚡ Focal transaction
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
