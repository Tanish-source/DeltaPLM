
import { useState } from "react";

export function Test(){
    const [count, setCount] = useState(10)

    return(
        <div>
            <p>{count}</p>

            <button onClick = {() => setCount(count + 1)}>Increase</button>

            <button onClick = {() => setCount(count - 1)}>Decrease</button>
            
        </div>
    )
}