import { Head } from "$fresh/runtime.ts";
import { AppProps } from "$fresh/server.ts";

export default function App(props: AppProps) {
    return (
        <>
            <Head>
                <title>MarkJam</title>
                <link rel="stylesheet" href="fonts/fonts.css" type="text/css" />
            </Head>
            <props.Component />
        </>
    );
}
