import React from 'react';

export function ProductCard({ product }) {
  return (
    <div className="card" onClick={() => openProduct(product.id)}>
      <img src={product.image} />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <a onClick={() => addToCart(product.id)}>Add to cart</a>
      <button className="icon" onClick={product.onRemove}>
        <svg viewBox="0 0 16 16"><path d="M2 2l12 12" /></svg>
      </button>
      <label>Quantity</label>
      <input type="number" tabIndex={2} />
    </div>
  );
}
