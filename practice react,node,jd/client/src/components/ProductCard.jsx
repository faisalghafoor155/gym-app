/** @format */

import React from "react";

export const ProductCard = () => {
  let name = "Laptop";
  let price = 1000;
  let category = "Electronics";
  return (
    <div>
      <h1>Product :{name}</h1>
      <p>Price:{price}</p>
      <p>Category: {category}</p>
    </div>
  );
};
