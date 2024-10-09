import * as React from "react"
const SvgComponent = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={16}
    height={16}
    fill="none"
    {...props}
  >
    <path
      fill="#000"
      fillOpacity={0.45}
      fillRule="evenodd"
      d="m13.14 1.827.002.001 1.03 1.03.001.002v.003L9.034 8l5.137 5.138.001.001v.003l-1.031 1.03-.001.001h-.003L8 9.034l-5.137 5.137-.002.001h-.003l-1.03-1.031v-.004L6.966 8 1.828 2.863v-.005l1.03-1.03h.005L8 6.966l5.138-5.138h.003Z"
      clipRule="evenodd"
    />
  </svg>
)
export default SvgComponent
