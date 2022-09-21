import { Head } from "$fresh/runtime.ts";
import { AppProps } from "$fresh/server.ts";

export default function App(props: AppProps) {
    return (
        <>
            <Head>
                <title>MarkJam</title>
                <link rel="preload" href="fonts/fonts.css" as="style" />
                <link
                    rel="preload"
                    href="fonts/unscii.woff"
                    as="font"
                    type="font/woff"
                    crossorigin
                />
                <link rel="stylesheet" href="fonts/fonts.css" type="text/css" />
            </Head>
            <props.Component />
        </>
    );
}
