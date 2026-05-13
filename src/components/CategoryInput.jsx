function CategoryInput({ category, value, onChange, disabled }) {
  return (
    <div className="category-card">
      <label>{category}</label>

      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(category, event.target.value)}
        placeholder={`Scrivi un ${category.toLowerCase()}`}
      />
    </div>
  );
}

export default CategoryInput;