"""
Offline evaluation of the face-recognition operating point.

The recogniser is a *pretrained* InsightFace ArcFace model (buffalo_l / w600k_r50).
This project never trains it — there are no epochs. What this project actually tunes
is the cosine-similarity *decision threshold* (config.THRESHOLD_CONFIRMED). So this
script evaluates the deployed pipeline the honest way: it measures how well the
512-d ArcFace embeddings already stored in faces.db separate genuine (same-person)
from impostor (different-person) pairs, and it sweeps the threshold to justify the
0.40 operating point.

No InsightFace / camera needed — it reads the stored embeddings only.

Run from the project root:
    py -3.11 -m daemon.face.eval_report

Writes PNG figures + metrics.json into  docs/assets/face-testing/.
"""

from __future__ import annotations

import json
from itertools import combinations
from pathlib import Path

import numpy as np

from . import config, faces_db
from .pipeline.matcher import cosine_similarity  # reuse the deployed cosine logic

# Output location: <repo>/docs/assets/face-testing/
REPO_ROOT = config.BASE_DIR.parents[1]           # daemon/face -> daemon -> repo root
OUT_DIR = REPO_ROOT / "docs" / "assets" / "face-testing"

# Sample enrollment photos for the dataset montage (developer's own face only)
SAMPLE_PHOTO_DIR = config.ENROLLMENT_DIR / "me"

# Palette echoing docs/technical-report.md (blue = impostor/edge, green = genuine/cloud)
C_GENUINE = "#2d8a4f"
C_IMPOSTOR = "#2980b9"
C_ACCENT = "#b08800"
C_CONFIRMED = "#8e44ad"


# ── Data loading ─────────────────────────────────────────────────────────────

def load_by_identity() -> dict[str, np.ndarray]:
    """Return {uid: (N, 512) matrix} from faces.db, grouped by identity."""
    rows = faces_db.load_all_embeddings()
    groups: dict[str, list[np.ndarray]] = {}
    for r in rows:
        groups.setdefault(r["uid"], []).append(np.asarray(r["embedding"], dtype=np.float32))
    return {uid: np.vstack(vecs) for uid, vecs in groups.items()}


# ── Pair construction ────────────────────────────────────────────────────────

def build_pairs(by_id: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """
    Genuine  = every within-identity embedding pair.
    Impostor = every cross-identity embedding pair.
    Returns (genuine_sims, impostor_sims).
    """
    genuine, impostor = [], []
    uids = list(by_id.keys())

    # Genuine: pairs inside each identity
    for uid in uids:
        M = by_id[uid]
        for i, j in combinations(range(len(M)), 2):
            genuine.append(cosine_similarity(M[i], M[j]))

    # Impostor: pairs across every distinct identity pair
    for ua, ub in combinations(uids, 2):
        A, B = by_id[ua], by_id[ub]
        for a in A:
            for b in B:
                impostor.append(cosine_similarity(a, b))

    return np.asarray(genuine), np.asarray(impostor)


def max_per_identity_scores(by_id: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """
    Realistic operating-point protocol mirroring matcher.match_against_db:
    leave one embedding out as the "query", score it against every identity by
    MAX similarity across that identity's remaining embeddings, and record:
      - genuine score  = max sim to the query's OWN identity (excluding itself)
      - top impostor   = max sim to any OTHER identity
    Returns (genuine_scores, impostor_scores), one entry per query embedding.
    """
    uids = list(by_id.keys())
    genuine_scores, impostor_scores = [], []

    for q_uid in uids:
        Mq = by_id[q_uid]
        for qi in range(len(Mq)):
            query = Mq[qi]
            # genuine: best match among same identity, excluding the query itself
            same = [cosine_similarity(query, Mq[k]) for k in range(len(Mq)) if k != qi]
            genuine_scores.append(max(same) if same else 0.0)
            # impostor: best match among all other identities
            best_other = 0.0
            for o_uid in uids:
                if o_uid == q_uid:
                    continue
                best_other = max(best_other, max(cosine_similarity(query, e) for e in by_id[o_uid]))
            impostor_scores.append(best_other)

    return np.asarray(genuine_scores), np.asarray(impostor_scores)


# ── Metrics ──────────────────────────────────────────────────────────────────

def roc_points(genuine: np.ndarray, impostor: np.ndarray, steps: int = 501):
    """Sweep threshold; return thresholds, FPR (=FAR), TPR (=1-FRR)."""
    lo = min(genuine.min(), impostor.min())
    hi = max(genuine.max(), impostor.max())
    thr = np.linspace(lo, hi, steps)
    tpr = np.array([(genuine >= t).mean() for t in thr])   # genuine accepted
    fpr = np.array([(impostor >= t).mean() for t in thr])  # impostor accepted
    return thr, fpr, tpr


def auc_from_roc(fpr: np.ndarray, tpr: np.ndarray) -> float:
    order = np.argsort(fpr)
    return float(np.trapz(tpr[order], fpr[order]))


def equal_error_rate(thr, fpr, tpr):
    """EER where FAR (fpr) crosses FRR (1-tpr)."""
    far = fpr
    frr = 1.0 - tpr
    idx = int(np.argmin(np.abs(far - frr)))
    return float((far[idx] + frr[idx]) / 2.0), float(thr[idx])


def metrics_at(threshold: float, genuine: np.ndarray, impostor: np.ndarray) -> dict:
    tp = int((genuine >= threshold).sum())
    fn = int((genuine < threshold).sum())
    fp = int((impostor >= threshold).sum())
    tn = int((impostor < threshold).sum())
    total = tp + fn + fp + tn
    acc = (tp + tn) / total if total else 0.0
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) else 0.0
    far = fp / (fp + tn) if (fp + tn) else 0.0
    frr = fn / (fn + tp) if (fn + tp) else 0.0
    return {
        "threshold": round(float(threshold), 4),
        "tp": tp, "fn": fn, "fp": fp, "tn": tn,
        "accuracy": round(acc, 4), "precision": round(prec, 4),
        "recall": round(rec, 4), "f1": round(f1, 4),
        "far": round(far, 4), "frr": round(frr, 4),
    }


# ── Figures ──────────────────────────────────────────────────────────────────

def fig_distributions(plt, genuine, impostor):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    bins = np.linspace(-0.1, 1.0, 56)
    ax.hist(impostor, bins=bins, alpha=0.6, color=C_IMPOSTOR, density=True,
            label=f"Impostor (different people, n={len(impostor)})")
    ax.hist(genuine, bins=bins, alpha=0.7, color=C_GENUINE, density=True,
            label=f"Genuine (same person, n={len(genuine)})")
    ax.axvline(config.THRESHOLD_POSSIBLE, color=C_ACCENT, ls="--", lw=1.5,
               label=f"POSSIBLE = {config.THRESHOLD_POSSIBLE}")
    ax.axvline(config.THRESHOLD_CONFIRMED, color="#c0392b", ls="-", lw=1.8,
               label=f"CONFIRMED = {config.THRESHOLD_CONFIRMED}")
    ax.set_xlabel("Cosine similarity")
    ax.set_ylabel("Probability density")
    ax.set_title("Genuine vs. impostor cosine-similarity separation")
    ax.legend(fontsize=8, loc="upper center")
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "similarity-distributions.png", dpi=150)
    plt.close(fig)


def fig_roc(plt, fpr, tpr, auc, eer, eer_thr):
    fig, ax = plt.subplots(figsize=(5.6, 5.2))
    ax.plot(fpr, tpr, color=C_IMPOSTOR, lw=2, label=f"ROC (AUC = {auc:.4f})")
    ax.plot([0, 1], [0, 1], color="#999", ls=":", lw=1)
    ax.scatter([eer], [1 - eer], color="#c0392b", zorder=5,
               label=f"EER = {eer:.3f} @ thr {eer_thr:.3f}")
    ax.set_xlabel("False Acceptance Rate (FAR)")
    ax.set_ylabel("True Acceptance Rate (1 − FRR)")
    ax.set_title("ROC — impostor acceptance vs. genuine acceptance")
    ax.legend(fontsize=9, loc="lower right")
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "roc-curve.png", dpi=150)
    plt.close(fig)


def fig_threshold_sweep(plt, genuine, impostor):
    thr = np.linspace(0.0, 0.9, 91)
    acc, prec, rec, f1, far, frr = [], [], [], [], [], []
    for t in thr:
        m = metrics_at(t, genuine, impostor)
        acc.append(m["accuracy"]); prec.append(m["precision"]); rec.append(m["recall"])
        f1.append(m["f1"]); far.append(m["far"]); frr.append(m["frr"])

    fig, ax = plt.subplots(figsize=(8.4, 4.8))
    ax.plot(thr, acc, color=C_GENUINE, lw=2, label="Accuracy")
    ax.plot(thr, f1, color=C_CONFIRMED, lw=2, label="F1")
    ax.plot(thr, prec, color=C_IMPOSTOR, lw=1.6, ls="--", label="Precision")
    ax.plot(thr, rec, color=C_ACCENT, lw=1.6, ls="--", label="Recall")
    ax.plot(thr, far, color="#c0392b", lw=1.4, ls=":", label="FAR")
    ax.plot(thr, frr, color="#16a085", lw=1.4, ls=":", label="FRR")
    ax.axvline(config.THRESHOLD_CONFIRMED, color="#333", lw=1.4,
               label=f"Deployed = {config.THRESHOLD_CONFIRMED}")
    ax.set_xlabel("Cosine-similarity decision threshold")
    ax.set_ylabel("Metric value")
    ax.set_title("Metric vs. decision threshold (the tuning curve behind the 0.40 operating point)")
    ax.legend(fontsize=8, ncol=2, loc="center right")
    ax.grid(alpha=0.25)
    ax.set_ylim(-0.02, 1.02)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "threshold-sweep.png", dpi=150)
    plt.close(fig)


def fig_confusion(plt, gen_scores, imp_scores, threshold):
    """Verification confusion matrix at the deployed threshold (max-per-identity protocol)."""
    tp = int((gen_scores >= threshold).sum())
    fn = int((gen_scores < threshold).sum())
    fp = int((imp_scores >= threshold).sum())
    tn = int((imp_scores < threshold).sum())
    mat = np.array([[tp, fn], [fp, tn]])

    fig, ax = plt.subplots(figsize=(5.0, 4.4))
    ax.imshow(mat, cmap="Greens")
    labels = [["TP", "FN"], ["FP", "TN"]]
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f"{labels[i][j]}\n{mat[i, j]}", ha="center", va="center",
                    fontsize=13, color="#111" if mat[i, j] < mat.max() * 0.6 else "#fff")
    ax.set_xticks([0, 1]); ax.set_xticklabels(["Accept (≥ thr)", "Reject (< thr)"])
    ax.set_yticks([0, 1]); ax.set_yticklabels(["Genuine query", "Impostor query"])
    ax.set_title(f"Verification confusion matrix @ threshold {threshold}")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "confusion-matrix.png", dpi=150)
    plt.close(fig)
    return dict(tp=tp, fn=fn, fp=fp, tn=tn)


def fig_identity_heatmap(plt, by_id):
    """Mean cross-identity similarity matrix (anonymised P01..Pn)."""
    uids = list(by_id.keys())
    n = len(uids)
    M = np.zeros((n, n))
    for a in range(n):
        for b in range(n):
            A, B = by_id[uids[a]], by_id[uids[b]]
            sims = [cosine_similarity(x, y)
                    for i, x in enumerate(A) for j, y in enumerate(B)
                    if not (a == b and i == j)]
            M[a, b] = float(np.mean(sims)) if sims else 0.0

    labels = [f"P{idx + 1:02d}" for idx in range(n)]
    fig, ax = plt.subplots(figsize=(6.4, 5.6))
    im = ax.imshow(M, cmap="viridis", vmin=0.0, vmax=1.0)
    ax.set_xticks(range(n)); ax.set_xticklabels(labels, rotation=90, fontsize=7)
    ax.set_yticks(range(n)); ax.set_yticklabels(labels, fontsize=7)
    ax.set_title("Mean cosine similarity between identities\n(diagonal = within-person)")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="mean cosine sim")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "identity-similarity-heatmap.png", dpi=150)
    plt.close(fig)


def fig_dataset_sample(plt):
    """Montage of the developer's own enrollment photos (no third-party faces)."""
    import cv2
    photos = sorted(p for p in SAMPLE_PHOTO_DIR.glob("*.jpg"))
    if not photos:
        print(f"  (skip dataset montage — no photos in {SAMPLE_PHOTO_DIR})")
        return
    photos = photos[:8]
    cols = 4
    rows = (len(photos) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 2.2, rows * 2.4))
    axes = np.atleast_1d(axes).ravel()
    for ax, p in zip(axes, photos):
        img = cv2.imread(str(p))
        if img is not None:
            ax.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        ax.set_title(p.stem.replace("photo_", ""), fontsize=6)
        ax.axis("off")
    for ax in axes[len(photos):]:
        ax.axis("off")
    fig.suptitle("Sample enrollment captures (one consenting subject) — varied angle / expression",
                 fontsize=9)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "dataset-sample.png", dpi=150)
    plt.close(fig)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    by_id = load_by_identity()
    n_identities = len(by_id)
    n_embeddings = sum(len(m) for m in by_id.values())
    print(f"Loaded {n_embeddings} embeddings across {n_identities} identities "
          f"from {config.FACES_DB.name}")

    genuine, impostor = build_pairs(by_id)
    gen_scores, imp_scores = max_per_identity_scores(by_id)

    thr, fpr, tpr = roc_points(genuine, impostor)
    auc = auc_from_roc(fpr, tpr)
    eer, eer_thr = equal_error_rate(thr, fpr, tpr)

    # F1-optimal threshold on the pairwise sets
    sweep_thr = np.linspace(0.0, 0.9, 91)
    f1s = [metrics_at(t, genuine, impostor)["f1"] for t in sweep_thr]
    f1_opt_thr = float(sweep_thr[int(np.argmax(f1s))])

    print("\nPer-threshold verification metrics (pairwise genuine vs impostor):")
    header = f"{'thr':>6} {'acc':>7} {'prec':>7} {'rec':>7} {'f1':>7} {'FAR':>7} {'FRR':>7}"
    print(header)
    at_thresholds = {}
    for label, t in [("possible", config.THRESHOLD_POSSIBLE),
                     ("confirmed", config.THRESHOLD_CONFIRMED),
                     ("f1_optimal", f1_opt_thr)]:
        m = metrics_at(t, genuine, impostor)
        at_thresholds[label] = m
        print(f"{m['threshold']:>6.3f} {m['accuracy']:>7.3f} {m['precision']:>7.3f} "
              f"{m['recall']:>7.3f} {m['f1']:>7.3f} {m['far']:>7.3f} {m['frr']:>7.3f}")

    print(f"\nAUC = {auc:.4f}   EER = {eer:.4f} @ thr {eer_thr:.3f}   "
          f"F1-optimal thr = {f1_opt_thr:.3f}")

    # Operating-point (max-per-identity) summary at deployed threshold
    op = metrics_at(config.THRESHOLD_CONFIRMED, gen_scores, imp_scores)
    print(f"\nOperating point (max-per-identity, thr {config.THRESHOLD_CONFIRMED}): "
          f"rank-style acc={op['accuracy']:.3f}, FAR={op['far']:.3f}, FRR={op['frr']:.3f}")

    # Figures
    print("\nRendering figures ->", OUT_DIR)
    fig_distributions(plt, genuine, impostor)
    fig_roc(plt, fpr, tpr, auc, eer, eer_thr)
    fig_threshold_sweep(plt, genuine, impostor)
    conf = fig_confusion(plt, gen_scores, imp_scores, config.THRESHOLD_CONFIRMED)
    fig_identity_heatmap(plt, by_id)
    fig_dataset_sample(plt)

    metrics = {
        "dataset": {
            "identities": n_identities,
            "embeddings": n_embeddings,
            "embeddings_per_identity": n_embeddings // n_identities if n_identities else 0,
            "embedding_dim": config.EMBEDDING_DIM,
            "genuine_pairs": int(len(genuine)),
            "impostor_pairs": int(len(impostor)),
        },
        "separation": {
            "genuine_mean": round(float(genuine.mean()), 4),
            "genuine_std": round(float(genuine.std()), 4),
            "genuine_min": round(float(genuine.min()), 4),
            "impostor_mean": round(float(impostor.mean()), 4),
            "impostor_std": round(float(impostor.std()), 4),
            "impostor_max": round(float(impostor.max()), 4),
        },
        "roc": {"auc": round(auc, 4), "eer": round(eer, 4), "eer_threshold": round(eer_thr, 4)},
        "thresholds": {"deployed_confirmed": config.THRESHOLD_CONFIRMED,
                       "deployed_possible": config.THRESHOLD_POSSIBLE,
                       "f1_optimal": round(f1_opt_thr, 4)},
        "metrics_at_threshold": at_thresholds,
        "operating_point_max_per_identity": {**op, "confusion": conf},
    }
    (OUT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("Wrote metrics.json")
    print("Done.")


if __name__ == "__main__":
    main()
